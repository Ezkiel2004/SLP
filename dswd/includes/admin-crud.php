<?php
/* =====================================================================
   Generic admin list / add / edit / publish / delete for one content table.
   A page in admin/ defines $resource (see admin/programs.php) and includes
   this file. Table and column names come only from that config, never from
   the request; every value goes through a prepared statement.

   $resource keys
     table, title (plural), singular, label (column used as the item's name)
     columns    [column => heading] for the list
     search     columns matched by the list's keyword search
     order      ORDER BY for the list (from config only)
     fields     form fields, see crud_field()
     publishable  true: draft/published with Publish and Unpublish
     soft_delete  true: Delete sets deleted_at instead of removing the row
     ability    optional ability needed for the whole page (e.g. 'categories')
     author     optional column set to the current user on create
     public_url optional fn(array $row): string, link to the item on the site
     validate   optional fn(array $data, array &$errors): void
   Field types: text, textarea, richtext, lines, slug, email, url, number, date,
   select, category, program, checkbox, image, file.
   ===================================================================== */
declare(strict_types=1);

$user = require_login();
if (!empty($resource['ability']) && !can($resource['ability'], $user)) {
    admin_error(403, 'Ask a super administrator if you need access.');
}
$self = basename($_SERVER['SCRIPT_NAME']);
$table = $resource['table'];
$publishable = !empty($resource['publishable']);
$soft = !empty($resource['soft_delete']);
$action = param('action') ?: 'list';
$id = int_param('id');
$errors = [];
$values = null;


/* ---------- helpers ---------- */

/** One row (with its child "lines" fields joined back into text), or null. */
function crud_load(array $resource, int $id): ?array
{
    $row = db_one(
        'SELECT * FROM ' . $resource['table'] . ' WHERE id = ?' . (!empty($resource['soft_delete']) ? ' AND deleted_at IS NULL' : ''),
        [$id]
    );
    if ($row === null) {
        return null;
    }
    foreach ($resource['fields'] as $f) {
        if (isset($f['child'])) {
            $c = $f['child'];
            $row[$f['name']] = implode("\n", array_column(
                db_all("SELECT {$c['column']} AS line FROM {$c['table']} WHERE {$c['fk']} = ? ORDER BY {$c['order']}", [$id]),
                'line'
            ));
        }
    }
    return $row;
}

function crud_can_edit(?array $row, array $user, bool $publishable): bool
{
    if ($row === null) {
        return can('create', $user);
    }
    return $publishable && $row['status'] === 'published' ? can('edit_published', $user) : can('edit_draft', $user);
}

function crud_can_delete(array $row, array $user, bool $publishable): bool
{
    return $publishable && $row['status'] === 'published' ? can('delete', $user) : can('delete_draft', $user);
}

/** Read and check the submitted form. Returns [column data, child lines, errors]. Uploads are stored only when everything else is valid. */
function crud_validate(array $resource, ?array $row): array
{
    $data = [];
    $children = [];
    $errors = [];
    $uploads = [];
    foreach ($resource['fields'] as $f) {
        $name = $f['name'];
        $label = $f['label'];
        $required = !empty($f['required']);
        $max = $f['max'] ?? 65535;
        switch ($f['type']) {
            case 'text':
            case 'textarea':
            case 'email':
            case 'url':
            case 'slug':
                $value = post($name);
                if ($f['type'] === 'slug' && $value === '') {
                    $value = slugify(post($f['from']));
                }
                if ($value === '' && $required) {
                    $errors[$name] = "Enter the $label";
                } elseif (mb_strlen($value) > $max) {
                    $errors[$name] = "$label must be $max characters or fewer";
                } elseif ($f['type'] === 'slug' && !preg_match('/^[a-z0-9-]+$/', $value)) {
                    $errors[$name] = "$label can use only lowercase letters, numbers and hyphens";
                } elseif ($f['type'] === 'email' && $value !== '' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    $errors[$name] = "Enter the $label in the correct format, like name@example.com";
                } elseif ($f['type'] === 'url' && $value !== '' && !preg_match('~^https://~', $value)) {
                    $errors[$name] = "$label must start with https://";
                }
                if ($f['type'] === 'slug' && !isset($errors[$name])
                    && (int) db_value("SELECT COUNT(*) FROM {$resource['table']} WHERE slug = ? AND id <> ?", [$value, $row['id'] ?? 0]) > 0) {
                    $errors[$name] = "Another item already uses this $label";
                }
                $data[$name] = $value;
                break;
            case 'richtext':
                $value = sanitize_rich_text(is_string($_POST[$name] ?? null) ? $_POST[$name] : '');
                if ($required && trim(strip_tags($value)) === '') {
                    $errors[$name] = "Enter the $label";
                }
                $data[$name] = $value;
                break;
            case 'lines':
                $items = lines(post($name));
                if ($required && !$items) {
                    $errors[$name] = "Enter at least one line for $label";
                }
                if (isset($f['child'])) {
                    $children[$name] = $items;
                } else {
                    $data[$name] = implode("\n", $items);
                }
                break;
            case 'number':
                $value = filter_var(post($name), FILTER_VALIDATE_INT, ['options' => ['min_range' => $f['min'] ?? 0, 'max_range' => $f['max'] ?? 32767]]);
                if ($value === false) {
                    $errors[$name] = "Enter $label as a whole number from " . ($f['min'] ?? 0) . ' to ' . ($f['max'] ?? 32767);
                }
                $data[$name] = $value === false ? null : $value;
                break;
            case 'date':
                $value = post($name);
                $date = DateTime::createFromFormat('!Y-m-d', $value);
                if (!$date || $date->format('Y-m-d') !== $value) {
                    $errors[$name] = "Enter the $label as a date";
                }
                $data[$name] = $value;
                break;
            case 'select':
                $value = post($name);
                if (!isset($f['options'][$value])) {
                    $errors[$name] = "Choose the $label";
                }
                $data[$name] = $value;
                break;
            case 'category':
            case 'program':
                $value = (int) post($name);
                $exists = $f['type'] === 'category'
                    ? db_value('SELECT COUNT(*) FROM categories WHERE id = ? AND type = ?', [$value, $f['category_type']])
                    : db_value('SELECT COUNT(*) FROM programs WHERE id = ? AND deleted_at IS NULL', [$value]);
                if ($value === 0) {
                    $value = null;
                    if ($required) {
                        $errors[$name] = "Choose the $label";
                    }
                } elseif (!(int) $exists) {
                    $errors[$name] = "Choose the $label from the list";
                }
                $data[$name] = $value;
                break;
            case 'checkbox':
                $data[$name] = post($name) === '1' ? 1 : 0;
                break;
            case 'image':
            case 'file':
                if (has_upload($name)) {
                    $uploads[] = $f;
                } elseif ($required && empty($row[$name])) {
                    $errors[$name] = "Choose a file for $label";
                }
                break;
        }
    }
    if (isset($resource['validate'])) {
        $resource['validate']($data, $errors);
    }
    if (!$errors) {
        foreach ($uploads as $f) {
            $stored = store_upload($f['name'], $f['type'] === 'image' ? 'image' : 'file');
            if (isset($stored['error'])) {
                $errors[$f['name']] = $stored['error'];
                continue;
            }
            $data[$f['name']] = $stored['path'];
            if (isset($f['size_column'])) {
                $data[$f['size_column']] = $stored['size'];
            }
        }
    } elseif ($uploads) {
        $errors[$uploads[0]['name']] ??= 'Fix the other errors, then choose the file again';
    }
    return [$data, $children, $errors];
}

/** Insert or update the row and its child lines in one transaction. Returns the id. */
function crud_save(array $resource, ?array $row, array $data, array $children, array $user): int
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        if ($row === null) {
            if (!empty($resource['publishable'])) {
                $data['status'] = 'draft';
            }
            if (!empty($resource['author'])) {
                $data[$resource['author']] = $user['id'];
            }
            $columns = array_keys($data);
            db_exec(
                'INSERT INTO ' . $resource['table'] . ' (' . implode(', ', $columns) . ') VALUES (' . implode(', ', array_fill(0, count($columns), '?')) . ')',
                array_values($data)
            );
            $id = (int) $pdo->lastInsertId();
        } else {
            $id = (int) $row['id'];
            if ($data) {
                db_exec(
                    'UPDATE ' . $resource['table'] . ' SET ' . implode(', ', array_map(fn ($c) => "$c = ?", array_keys($data))) . ' WHERE id = ?',
                    [...array_values($data), $id]
                );
            }
        }
        foreach ($resource['fields'] as $f) {
            if (!isset($f['child'], $children[$f['name']])) {
                continue;
            }
            $c = $f['child'];
            db_exec("DELETE FROM {$c['table']} WHERE {$c['fk']} = ?", [$id]);
            foreach ($children[$f['name']] as $i => $line) {
                db_exec("INSERT INTO {$c['table']} ({$c['fk']}, {$c['column']}, {$c['order']}) VALUES (?, ?, ?)", [$id, $line, $i + 1]);
            }
        }
        $pdo->commit();
        return $id;
    } catch (Throwable $ex) {
        $pdo->rollBack();
        throw $ex;
    }
}

/** Form control for one field (label, hint and error included). */
function crud_field(array $f, array $values, array $errors, bool $readonly): string
{
    $name = $f['name'];
    $id = 'f-' . $name;
    $value = (string) ($values[$name] ?? ($f['default'] ?? ''));
    $hint = $f['hint'] ?? '';
    $error = $errors[$name] ?? null;
    $aria = admin_aria($id, $hint !== '', $error !== null);
    $req = !empty($f['required']) && !in_array($f['type'], ['image', 'file'], true) ? ' required' : '';
    $dis = $readonly ? ' disabled' : '';
    $common = ' id="' . e($id) . '" name="' . e($name) . '"' . $aria . $dis;
    switch ($f['type']) {
        case 'textarea':
        case 'lines':
            $control = '<textarea class="input"' . $common . ' rows="' . ($f['rows'] ?? 4) . '"' . $req . '>' . e($value) . '</textarea>';
            break;
        case 'richtext':
            $control = '<textarea class="input"' . $common . ' rows="10" data-richtext' . $req . '>' . e($value) . '</textarea>';
            break;
        case 'select':
        case 'category':
        case 'program':
            if ($f['type'] === 'select') {
                $opts = $f['options'];
            } elseif ($f['type'] === 'category') {
                $opts = ['' => 'None'] + array_column(db_all('SELECT id, name FROM categories WHERE type = ? ORDER BY sort_order, name', [$f['category_type']]), 'name', 'id');
            } else {
                $opts = ['' => 'Not linked to a program'] + array_column(db_all('SELECT id, title_en FROM programs WHERE deleted_at IS NULL ORDER BY title_en'), 'title_en', 'id');
            }
            $control = '<div class="select"><select class="input"' . $common . $req . '>' . options($opts, $value) . '</select>' . icon('chevron-down') . '</div>';
            break;
        case 'checkbox':
            return '<div class="choices"><label class="choice"><input type="checkbox" id="' . e($id) . '" name="' . e($name) . '" value="1"'
                . ($value === '1' ? ' checked' : '') . $dis . '>' . e($f['label']) . '</label></div>';
        case 'image':
        case 'file':
            $accept = $f['type'] === 'image' ? 'image/jpeg,image/png' : 'application/pdf,image/jpeg,image/png';
            $current = $value !== '' ? '<p class="field__hint">Current file: <a href="' . e(url($value)) . '">' . e(basename($value)) . '</a>. Choose a new file to replace it.</p>' : '';
            $control = $current . '<input class="input" type="file" accept="' . $accept . '"' . $common . '>';
            break;
        case 'number':
            $control = '<input class="input" type="number" inputmode="numeric"' . $common . ' value="' . e($value) . '"' . $req . '>';
            break;
        default:
            $type = ['email' => 'email', 'url' => 'url', 'date' => 'date'][$f['type']] ?? 'text';
            $control = '<input class="input" type="' . $type . '"' . $common . ' value="' . e($value) . '"' . (isset($f['max']) ? ' maxlength="' . (int) $f['max'] . '"' : '') . $req . '>';
    }
    return admin_field($id, $f['label'], $control, $hint, $error, !empty($f['required']));
}


/* ---------- actions ---------- */

if (is_post()) {
    require_csrf();
    $do = post('do');
    $row = $id ? crud_load($resource, $id) : null;
    if ($id && $row === null) {
        admin_error(404, 'This item does not exist or was deleted.');
    }
    $name = $row ? (string) $row[$resource['label']] : '';

    if ($do === 'save') {
        if (!crud_can_edit($row, $user, $publishable)) {
            admin_error(403, $row && $publishable && $row['status'] === 'published'
                ? 'Only publishers can change published items. Ask a publisher to unpublish it first.'
                : 'Your role cannot make this change.');
        }
        [$data, $children, $errors] = crud_validate($resource, $row);
        if (!$errors) {
            $id = crud_save($resource, $row, $data, $children, $user);
            audit($row ? 'update' : 'create', $table, $id, mb_substr((string) ($data[$resource['label']] ?? $name), 0, 120));
            flash('success', ucfirst($resource['singular']) . ' saved.' . ($publishable && (!$row || $row['status'] === 'draft') ? ' It stays a draft until a publisher publishes it.' : ''));
            redirect('admin/' . $self, ['action' => 'edit', 'id' => $id]);
        }
        $values = array_merge($row ?? [], $_POST, $data, array_map(fn ($l) => implode("\n", $l), $children));
        $action = $row ? 'edit' : 'new';
    } elseif (($do === 'publish' || $do === 'unpublish') && $row) {
        if (!$publishable || !can('publish', $user)) {
            admin_error(403, 'Only publishers can publish or unpublish.');
        }
        $status = $do === 'publish' ? 'published' : 'draft';
        db_exec("UPDATE $table SET status = ? WHERE id = ?", [$status, $id]);
        if ($do === 'publish' && array_key_exists('published_at', $row) && $row['published_at'] === null) {
            db_exec("UPDATE $table SET published_at = NOW() WHERE id = ?", [$id]);
        }
        audit($do, $table, $id, mb_substr($name, 0, 120));
        flash('success', ucfirst($resource['singular']) . ($do === 'publish' ? ' published. It is now on the website.' : ' unpublished. It is no longer on the website.'));
        redirect('admin/' . $self, ['action' => 'edit', 'id' => $id]);
    } elseif ($do === 'delete' && $row) {
        if (!crud_can_delete($row, $user, $publishable)) {
            admin_error(403, 'Only publishers can delete published items.');
        }
        db_exec($soft ? "UPDATE $table SET deleted_at = NOW() WHERE id = ?" : "DELETE FROM $table WHERE id = ?", [$id]);
        audit('delete', $table, $id, mb_substr($name, 0, 120));
        flash('success', ucfirst($resource['singular']) . ' deleted.');
        redirect('admin/' . $self);
    } else {
        admin_error(404, 'Unknown action.');
    }
}


/* ---------- pages ---------- */

if ($action === 'new' || $action === 'edit') {
    $row = $action === 'edit' ? crud_load($resource, $id) : null;
    if ($action === 'edit' && $row === null) {
        admin_error(404, 'This item does not exist or was deleted.');
    }
    if ($action === 'new' && !can('create', $user)) {
        admin_error(403, 'Your role cannot add items.');
    }
    $values ??= $row ?? [];
    $canEdit = crud_can_edit($row, $user, $publishable);
    $heading = $row ? 'Edit ' . $resource['singular'] : 'Add ' . $resource['singular'];
    admin_start($heading, $user);
    ?>
    <p><a href="<?= e(url('admin/' . $self)) ?>"><?= icon('chevron-left') ?>Back to <?= e(strtolower($resource['title'])) ?></a></p>
    <h1><?= e($heading) ?></h1>
    <?php if ($row && $publishable): ?>
    <p class="meta">
        <span>Status: <strong><?= $row['status'] === 'published' ? 'Published' : 'Draft' ?></strong></span>
        <?php if ($row['status'] === 'published' && isset($resource['public_url'])): ?><a href="<?= e(($resource['public_url'])($row)) ?>">View on the website</a><?php endif; ?>
    </p>
    <?php endif; ?>
    <?php if (!$canEdit): ?>
    <p class="note"><?= $row && $publishable && $row['status'] === 'published' ? 'This item is published. Only publishers can change it.' : 'Your role can view this item but not change it.' ?></p>
    <?php endif; ?>
    <?= admin_error_summary($errors) ?>

    <form class="form-stack" action="<?= e(url('admin/' . $self, ['id' => $row['id'] ?? null])) ?>" method="post" enctype="multipart/form-data">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="save">
        <?php foreach ($resource['fields'] as $f): ?>
        <?= crud_field($f, $values, $errors, !$canEdit) ?>
        <?php endforeach; ?>
        <?php if ($canEdit): ?>
        <p><button class="btn btn--primary" type="submit"><?= icon('check') ?>Save</button></p>
        <?php endif; ?>
    </form>

    <?php if ($row): ?>
    <div class="form-actions">
        <?php if ($publishable && can('publish', $user)): ?>
        <form action="<?= e(url('admin/' . $self, ['id' => $row['id']])) ?>" method="post">
            <?= csrf_field() ?>
            <input type="hidden" name="do" value="<?= $row['status'] === 'published' ? 'unpublish' : 'publish' ?>">
            <button class="btn btn--secondary" type="submit"><?= $row['status'] === 'published' ? 'Unpublish' : 'Publish' ?></button>
        </form>
        <?php endif; ?>
        <?php if (crud_can_delete($row, $user, $publishable)): ?>
        <a class="btn btn--ghost" href="<?= e(url('admin/' . $self, ['action' => 'delete', 'id' => $row['id']])) ?>">Delete</a>
        <?php endif; ?>
    </div>
    <?php endif;
    admin_end();
    exit;
}

if ($action === 'delete') {
    $row = crud_load($resource, $id);
    if ($row === null) {
        admin_error(404, 'This item does not exist or was deleted.');
    }
    if (!crud_can_delete($row, $user, $publishable)) {
        admin_error(403, 'Only publishers can delete published items.');
    }
    admin_start('Delete ' . $resource['singular'], $user);
    ?>
    <h1>Delete this <?= e($resource['singular']) ?>?</h1>
    <p><strong><?= e((string) $row[$resource['label']]) ?></strong></p>
    <p><?= $soft ? 'It disappears from the website and from this list. It stays in the database, so it can be restored from a backup.' : 'This cannot be undone.' ?></p>
    <form class="form-actions" action="<?= e(url('admin/' . $self, ['id' => $row['id']])) ?>" method="post">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="delete">
        <button class="btn btn--primary" type="submit">Yes, delete it</button>
        <a class="btn btn--ghost" href="<?= e(url('admin/' . $self, ['action' => 'edit', 'id' => $row['id']])) ?>">Cancel</a>
    </form>
    <?php
    admin_end();
    exit;
}

// List
$q = param('q');
$status = in_array(param('status'), ['draft', 'published'], true) ? param('status') : '';
$where = $soft ? ['deleted_at IS NULL'] : ['1 = 1'];
$params = [];
if ($q !== '' && !empty($resource['search'])) {
    $where[] = '(' . implode(' OR ', array_map(fn ($c) => "$c LIKE ?", $resource['search'])) . ')';
    array_push($params, ...array_fill(0, count($resource['search']), like($q)));
}
if ($publishable && $status !== '') {
    $where[] = 'status = ?';
    $params[] = $status;
}
$perPage = 20;
$current = int_param('page', 1);
$total = (int) db_value("SELECT COUNT(*) FROM $table WHERE " . implode(' AND ', $where), $params);
$rows = db_all(
    "SELECT * FROM $table WHERE " . implode(' AND ', $where) . ' ORDER BY ' . $resource['order'] . page_limit($current, $perPage),
    $params
);

admin_start($resource['title'], $user);
?>
<div class="page-head">
    <h1><?= e($resource['title']) ?></h1>
    <?php if (can('create', $user)): ?>
    <a class="btn btn--primary" href="<?= e(url('admin/' . $self, ['action' => 'new'])) ?>"><?= icon('check') ?>Add <?= e($resource['singular']) ?></a>
    <?php endif; ?>
</div>

<form class="filters" action="<?= e(url('admin/' . $self)) ?>" method="get" role="search" aria-label="Find <?= e(strtolower($resource['title'])) ?>">
    <?php if (!empty($resource['search'])): ?>
    <?= admin_field('f-q', 'Keyword', '<input class="input" id="f-q" name="q" type="search" value="' . e($q) . '">') ?>
    <?php endif; ?>
    <?php if ($publishable): ?>
    <?= admin_field('f-status', 'Status', '<div class="select"><select class="input" id="f-status" name="status">' . options(['' => 'All', 'published' => 'Published', 'draft' => 'Draft'], $status) . '</select>' . icon('chevron-down') . '</div>') ?>
    <?php endif; ?>
    <div class="filters__actions">
        <button class="btn btn--secondary" type="submit"><?= icon('search') ?>Show results</button>
        <?php if ($q !== '' || $status !== ''): ?><a href="<?= e(url('admin/' . $self)) ?>">Clear filters</a><?php endif; ?>
    </div>
</form>

<p class="results-count">Results: <?= $total ?></p>
<?php if ($rows): ?>
<div class="table-wrap" role="region" aria-labelledby="list-caption" tabindex="0">
    <table class="table">
        <caption id="list-caption"><?= e($resource['title']) ?></caption>
        <thead>
            <tr>
                <?php foreach ($resource['columns'] as $heading): ?><th scope="col"><?= e($heading) ?></th><?php endforeach; ?>
                <?php if ($publishable): ?><th scope="col">Status</th><?php endif; ?>
                <th scope="col"><span class="visually-hidden">Actions</span></th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($rows as $row): ?>
            <tr>
                <?php foreach (array_keys($resource['columns']) as $column): ?><td><?= e((string) $row[$column]) ?></td><?php endforeach; ?>
                <?php if ($publishable): ?><td><?= $row['status'] === 'published' ? 'Published' : 'Draft' ?></td><?php endif; ?>
                <td><a href="<?= e(url('admin/' . $self, ['action' => 'edit', 'id' => $row['id']])) ?>"><?= crud_can_edit($row, $user, $publishable) ? 'Edit' : 'View' ?><span class="visually-hidden"> <?= e((string) $row[$resource['label']]) ?></span></a></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?= pagination($total, $current, $perPage, 'admin/' . $self, ['q' => $q, 'status' => $status]) ?>
<?php else: ?>
<div class="empty"><p class="empty__title">Nothing here yet</p><p>Change the filters, or add the first <?= e($resource['singular']) ?>.</p></div>
<?php endif; ?>
<?php admin_end();

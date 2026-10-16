<?php
/* Public content from MySQL. Same function names and shapes as the phase 2
   placeholder layer, so the page templates barely changed. Every query
   returns only published, not-deleted rows, through prepared statements. */
declare(strict_types=1);

const REGIONS = [
    'NCR' => 'National Capital Region (NCR)', 'CAR' => 'Cordillera Administrative Region (CAR)',
    'I' => 'Region I (Ilocos Region)', 'II' => 'Region II (Cagayan Valley)', 'III' => 'Region III (Central Luzon)',
    'IV-A' => 'Region IV-A (CALABARZON)', 'MIMAROPA' => 'MIMAROPA Region', 'V' => 'Region V (Bicol Region)',
    'VI' => 'Region VI (Western Visayas)', 'VII' => 'Region VII (Central Visayas)', 'VIII' => 'Region VIII (Eastern Visayas)',
    'IX' => 'Region IX (Zamboanga Peninsula)', 'X' => 'Region X (Northern Mindanao)', 'XI' => 'Region XI (Davao Region)',
    'XII' => 'Region XII (SOCCSKSARGEN)', 'Caraga' => 'Caraga',
];

/** Escape % and _ so a search term matches literally inside LIKE '%…%'. */
function like(string $q): string
{
    return '%' . addcslashes($q, '%_\\') . '%';
}

/** Non-empty trimmed lines of a text field. */
function lines(string $text): array
{
    return array_values(array_filter(array_map('trim', preg_split('/\R/', $text) ?: []), 'strlen'));
}

/** SQL LIMIT/OFFSET for a page; "all" when $perPage is PHP_INT_MAX. */
function page_limit(int $page, int $perPage): string
{
    return $perPage >= PHP_INT_MAX ? '' : ' LIMIT ' . max(1, $perPage) . ' OFFSET ' . max(0, ($page - 1) * $perPage);
}

/** [slug => name] for a category type: program, news, download, faq. */
function get_categories(string $type): array
{
    return array_column(db_all('SELECT slug, name FROM categories WHERE type = ? ORDER BY sort_order, name', [$type]), 'name', 'slug');
}


/* ---------- programs ---------- */

function shape_program(array $p): array
{
    $p['title'] = LANG === 'fil' && $p['title_fil'] !== '' ? $p['title_fil'] : $p['title_en'];
    $p['category'] = $p['category_slug'] ?? '';
    $p['category_label'] = $p['category_name'] ?? '';
    $p['featured'] = (bool) $p['is_featured'];
    return $p;
}

/** Programs and services. Filters: q, kind (program|service), category (slug), featured. */
function get_programs(array $filters = []): array
{
    $where = ["p.status = 'published'", 'p.deleted_at IS NULL'];
    $params = [];
    if (($filters['kind'] ?? '') !== '') {
        $where[] = 'p.kind = ?';
        $params[] = $filters['kind'];
    }
    if (($filters['category'] ?? '') !== '') {
        $where[] = 'c.slug = ?';
        $params[] = $filters['category'];
    }
    if (!empty($filters['featured'])) {
        $where[] = 'p.is_featured = 1';
    }
    if (($filters['q'] ?? '') !== '') {
        $where[] = '(p.title_en LIKE ? OR p.title_fil LIKE ? OR p.summary LIKE ?)';
        array_push($params, like($filters['q']), like($filters['q']), like($filters['q']));
    }
    return array_map('shape_program', db_all(
        'SELECT p.id, p.slug, p.kind, p.title_en, p.title_fil, p.summary, p.is_featured, c.slug AS category_slug, c.name AS category_name
         FROM programs p LEFT JOIN categories c ON c.id = p.category_id
         WHERE ' . implode(' AND ', $where) . ' ORDER BY p.id',
        $params
    ));
}

/** One program with its eligibility, requirements, steps and forms. */
function get_program(string $slug): ?array
{
    $p = db_one(
        "SELECT p.*, c.slug AS category_slug, c.name AS category_name
         FROM programs p LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.slug = ? AND p.status = 'published' AND p.deleted_at IS NULL",
        [$slug]
    );
    if ($p === null) {
        return null;
    }
    $p = shape_program($p);
    $p['eligibility'] = lines($p['eligibility']);
    $p['requirements'] = array_column(db_all('SELECT requirement FROM program_requirements WHERE program_id = ? ORDER BY sort_order, id', [$p['id']]), 'requirement');
    $p['steps'] = array_column(db_all('SELECT instruction FROM program_steps WHERE program_id = ? ORDER BY step_no', [$p['id']]), 'instruction');
    $p['form_files'] = array_map('shape_download', db_all(
        "SELECT d.*, c.slug AS category_slug, c.name AS category_name
         FROM downloads d LEFT JOIN categories c ON c.id = d.category_id
         WHERE d.program_id = ? AND d.status = 'published' AND d.deleted_at IS NULL ORDER BY d.title",
        [$p['id']]
    ));
    return $p;
}


/* ---------- news and announcements ---------- */

function shape_news(array $n): array
{
    return $n + [
        'date' => substr((string) $n['published_at'], 0, 10),
        'category' => $n['category_slug'] ?? '',
        'category_label' => $n['category_name'] ?? '',
        'image' => $n['cover_image'] ?: 'img/placeholder-photo.svg',
        'image_alt' => $n['cover_image'] ? $n['cover_alt'] : '',
    ];
}

/** Published news, newest first. Filters: q, category. Returns ['items', 'total']. */
function get_news(array $filters = [], int $page = 1, int $perPage = 6): array
{
    $where = ["n.status = 'published'", 'n.deleted_at IS NULL', 'n.published_at <= NOW()'];
    $params = [];
    if (($filters['category'] ?? '') !== '') {
        $where[] = 'c.slug = ?';
        $params[] = $filters['category'];
    }
    if (($filters['q'] ?? '') !== '') {
        $where[] = '(n.title LIKE ? OR n.excerpt LIKE ?)';
        array_push($params, like($filters['q']), like($filters['q']));
    }
    $from = ' FROM news_articles n LEFT JOIN categories c ON c.id = n.category_id WHERE ' . implode(' AND ', $where);
    return [
        'items' => array_map('shape_news', db_all(
            'SELECT n.id, n.slug, n.title, n.excerpt, n.cover_image, n.cover_alt, n.published_at, c.slug AS category_slug, c.name AS category_name'
            . $from . ' ORDER BY n.published_at DESC, n.id DESC' . page_limit($page, $perPage),
            $params
        )),
        'total' => (int) db_value('SELECT COUNT(*)' . $from, $params),
    ];
}

function get_article(string $slug): ?array
{
    $n = db_one(
        "SELECT n.*, c.slug AS category_slug, c.name AS category_name
         FROM news_articles n LEFT JOIN categories c ON c.id = n.category_id
         WHERE n.slug = ? AND n.status = 'published' AND n.deleted_at IS NULL AND n.published_at <= NOW()",
        [$slug]
    );
    return $n ? shape_news($n) : null;
}

/** Announcements showing today, pinned first, then newest. */
function get_announcements(): array
{
    return db_all(
        "SELECT title, body, starts_at, ends_at, is_pinned AS pinned FROM announcements
         WHERE status = 'published' AND deleted_at IS NULL AND starts_at <= CURDATE() AND ends_at >= CURDATE()
         ORDER BY is_pinned DESC, starts_at DESC, id DESC"
    );
}


/* ---------- downloads, offices, FAQs, officials ---------- */

function shape_download(array $d): array
{
    return $d + [
        'category' => $d['category_slug'] ?? '',
        'category_label' => $d['category_name'] ?? '',
        'size' => (int) $d['file_size'],
        'file' => $d['file_path'],
        'year' => (int) $d['year'],
    ];
}

/** Published downloads, newest year first. Filters: q, category, year. Returns ['items', 'total']. */
function get_downloads(array $filters = [], int $page = 1, int $perPage = PHP_INT_MAX): array
{
    $where = ["d.status = 'published'", 'd.deleted_at IS NULL'];
    $params = [];
    if (($filters['category'] ?? '') !== '') {
        $where[] = 'c.slug = ?';
        $params[] = $filters['category'];
    }
    if (!empty($filters['year'])) {
        $where[] = 'd.year = ?';
        $params[] = (int) $filters['year'];
    }
    if (($filters['q'] ?? '') !== '') {
        $where[] = 'd.title LIKE ?';
        $params[] = like($filters['q']);
    }
    $from = ' FROM downloads d LEFT JOIN categories c ON c.id = d.category_id WHERE ' . implode(' AND ', $where);
    return [
        'items' => array_map('shape_download', db_all(
            'SELECT d.*, c.slug AS category_slug, c.name AS category_name' . $from
            . ' ORDER BY d.year DESC, d.title' . page_limit($page, $perPage),
            $params
        )),
        'total' => (int) db_value('SELECT COUNT(*)' . $from, $params),
    ];
}

/** Years that have published downloads, newest first. */
function get_download_years(): array
{
    return array_map('intval', array_column(db_all(
        "SELECT DISTINCT year FROM downloads WHERE status = 'published' AND deleted_at IS NULL ORDER BY year DESC"
    ), 'year'));
}

/** [code => label] of regions. */
function get_regions(): array
{
    return REGIONS;
}

/** Published offices, optionally for one region code. */
function get_offices(string $region = ''): array
{
    $rows = db_all(
        "SELECT name, region, address, phone, email, hours FROM offices
         WHERE status = 'published' AND deleted_at IS NULL AND (? = '' OR region = ?)
         ORDER BY sort_order, name",
        [$region, $region]
    );
    return array_map(fn ($o) => $o + ['region_label' => REGIONS[$o['region']] ?? $o['region']], $rows);
}

/** Published FAQs grouped by topic: [topic name => [faq, …]]. */
function get_faqs(): array
{
    $groups = [];
    foreach (db_all(
        "SELECT f.question, f.answer, COALESCE(c.name, 'Other questions') AS topic
         FROM faqs f LEFT JOIN categories c ON c.id = f.topic_id
         WHERE f.status = 'published' AND f.deleted_at IS NULL
         ORDER BY c.sort_order IS NULL, c.sort_order, f.sort_order, f.id"
    ) as $faq) {
        $groups[$faq['topic']][] = $faq;
    }
    return $groups;
}

function get_officials(): array
{
    return db_all("SELECT name, position, photo FROM officials WHERE status = 'published' AND deleted_at IS NULL ORDER BY sort_order, id");
}

/** Site search across programs, news, downloads and FAQs. */
function search_site(string $q): array
{
    if ($q === '') {
        return [];
    }
    return array_filter([
        'programs' => get_programs(['q' => $q]),
        'news' => get_news(['q' => $q], 1, PHP_INT_MAX)['items'],
        'downloads' => get_downloads(['q' => $q])['items'],
        'faqs' => db_all(
            "SELECT question, answer FROM faqs WHERE status = 'published' AND deleted_at IS NULL AND (question LIKE ? OR answer LIKE ?) ORDER BY sort_order, id",
            [like($q), like($q)]
        ),
    ]);
}

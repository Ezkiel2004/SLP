<?php
/* Rich text sanitizer for content saved from the admin editor. Keeps a small
   allow-list of tags and safe links and drops everything else: scripts, styles,
   event attributes, unknown tags. Run it when saving; the stored HTML is then
   printed as is. */
declare(strict_types=1);

const RICH_TAGS = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'a', 'blockquote'];
const RICH_RENAME = ['b' => 'strong', 'i' => 'em', 'h1' => 'h2', 'h4' => 'h3', 'h5' => 'h3', 'h6' => 'h3', 'div' => 'p'];
const RICH_DROP = ['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'form', 'input', 'button', 'textarea', 'select'];

function sanitize_rich_text(string $html): string
{
    $html = trim($html);
    if ($html === '') {
        return '';
    }
    $source = new DOMDocument();
    $previous = libxml_use_internal_errors(true);
    $source->loadHTML('<?xml encoding="utf-8"?><div>' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NONET);
    libxml_clear_errors();
    libxml_use_internal_errors($previous);

    $out = new DOMDocument();
    $root = $out->appendChild($out->createElement('div'));
    rich_copy($source->documentElement, $root, $out);

    $result = '';
    foreach ($root->childNodes as $child) {
        $result .= $out->saveHTML($child);
    }
    return trim($result);
}

/** Copy the allowed parts of $from's children into $to. */
function rich_copy(DOMNode $from, DOMNode $to, DOMDocument $out): void
{
    foreach ($from->childNodes as $node) {
        if ($node instanceof DOMText) {
            $to->appendChild($out->createTextNode($node->nodeValue ?? ''));
            continue;
        }
        if (!$node instanceof DOMElement) {
            continue; // comments, processing instructions
        }
        $tag = strtolower($node->tagName);
        if (in_array($tag, RICH_DROP, true)) {
            continue; // dropped together with its content
        }
        $tag = RICH_RENAME[$tag] ?? $tag;
        if (!in_array($tag, RICH_TAGS, true)) {
            rich_copy($node, $to, $out); // unknown tag: keep its text, lose the tag
            continue;
        }
        $element = $out->createElement($tag);
        if ($tag === 'a') {
            $href = trim($node->getAttribute('href'));
            if (!preg_match('~^(https?://|mailto:|/(?!/)|#)~i', $href)) {
                rich_copy($node, $to, $out); // unsafe or empty link: keep the text only
                continue;
            }
            $element->setAttribute('href', $href);
            if (preg_match('~^https?://~i', $href)) {
                $element->setAttribute('rel', 'noopener noreferrer');
            }
        }
        rich_copy($node, $element, $out);
        $to->appendChild($element);
    }
}

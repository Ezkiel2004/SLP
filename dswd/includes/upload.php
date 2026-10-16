<?php
/* File uploads: only PDF, JPG and PNG; size-limited; the type is read from the
   file's content (never from its name); saved under a new random name in
   uploads/images or uploads/files, where nothing can run as a script.
   Images: at most IMAGE_MAX_SIDE pixels (js/admin.js scales bigger photos down
   before they upload), and stored without metadata (Data Privacy Act: phone
   photos carry the GPS position, the device and sometimes names). */
declare(strict_types=1);

const IMAGE_MAX_SIDE = 1600; // pixels: a full-width photo on a 2x screen

const UPLOAD_TYPES = [
    'image' => ['image/jpeg' => 'jpg', 'image/png' => 'png'],
    'file' => ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png'],
];

/** True when the form sent a file for this field. */
function has_upload(string $field): bool
{
    return isset($_FILES[$field]) && is_array($_FILES[$field]) && ($_FILES[$field]['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
}

/** Validate and store one upload. Returns ['path' => …, 'size' => …] or ['error' => message]. */
function store_upload(string $field, string $kind): array
{
    $file = $_FILES[$field] ?? null;
    $limit = $kind === 'image' ? CONFIG['upload_max_image'] : CONFIG['upload_max_file'];
    $types = UPLOAD_TYPES[$kind];
    if (!is_array($file) || !is_int($file['error'] ?? null) || $file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
        $tooBig = in_array($file['error'] ?? null, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true);
        return ['error' => $tooBig ? 'The file must be smaller than ' . format_bytes($limit) . '.' : 'The file did not upload. Try again.'];
    }
    if ($file['size'] <= 0 || $file['size'] > $limit) {
        return ['error' => 'The file must be smaller than ' . format_bytes($limit) . '.'];
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $extension = $types[$mime] ?? null;
    if ($extension === null) {
        return ['error' => $kind === 'image' ? 'Upload a JPG or PNG image.' : 'Upload a PDF, JPG or PNG file.'];
    }
    $data = (string) file_get_contents($file['tmp_name']);
    if ($extension !== 'pdf') {
        $size = @getimagesizefromstring($data);
        $data = $size === false ? null : ($extension === 'jpg' ? strip_jpeg_metadata($data) : strip_png_metadata($data));
        if ($data === null) {
            return ['error' => 'The image file is damaged. Try another file.'];
        }
        if (max($size[0], $size[1]) > IMAGE_MAX_SIDE) {
            return ['error' => 'Make the image at most ' . IMAGE_MAX_SIDE . ' pixels wide and high, then upload it again.'];
        }
    }
    $folder = $kind === 'image' ? 'uploads/images' : 'uploads/files';
    $name = bin2hex(random_bytes(16)) . '.' . $extension;
    if (file_put_contents(dirname(__DIR__) . '/' . $folder . '/' . $name, $data) !== strlen($data)) {
        return ['error' => 'The file could not be saved. Try again.'];
    }
    return ['path' => $folder . '/' . $name, 'size' => strlen($data)];
}

/** A JPG without its metadata segments (Exif, XMP, IPTC, comments), or null
    when the file structure is broken. Only the Exif orientation is written
    back, so phone photos stay upright. */
function strip_jpeg_metadata(string $jpg): ?string
{
    if (!str_starts_with($jpg, "\xFF\xD8")) {
        return null;
    }
    $segments = [];
    $orientation = 1;
    $pos = 2;
    while (true) {
        if ($pos + 4 > strlen($jpg) || $jpg[$pos] !== "\xFF") {
            return null;
        }
        $marker = ord($jpg[$pos + 1]);
        if ($marker === 0xFF) { // fill byte
            $pos++;
            continue;
        }
        if ($marker === 0xDA) { // start of scan: the image data runs to the end
            break;
        }
        $length = unpack('n', $jpg, $pos + 2)[1];
        if ($length < 2 || $pos + 2 + $length > strlen($jpg)) {
            return null;
        }
        $segment = substr($jpg, $pos, $length + 2);
        if ($marker === 0xE1) { // APP1: Exif or XMP
            $orientation = exif_orientation(substr($segment, 4)) ?? $orientation;
        } elseif ($marker !== 0xED && $marker !== 0xFE) { // drop APP13 (IPTC) and comments
            $segments[] = $segment;
        }
        $pos += $length + 2;
    }
    if ($orientation !== 1) {
        $tiff = "MM\x00\x2A\x00\x00\x00\x08\x00\x01\x01\x12\x00\x03\x00\x00\x00\x01" . pack('n', $orientation) . "\x00\x00\x00\x00\x00\x00";
        $app1 = "\xFF\xE1" . pack('n', 8 + strlen($tiff)) . "Exif\x00\x00" . $tiff;
        $first = isset($segments[0]) && $segments[0][1] === "\xE0" ? 1 : 0; // after the JFIF header, if any
        array_splice($segments, $first, 0, [$app1]);
    }
    return "\xFF\xD8" . implode('', $segments) . substr($jpg, $pos);
}

/** The orientation (1 to 8) from an APP1 Exif payload, or null. */
function exif_orientation(string $app1): ?int
{
    if (!str_starts_with($app1, "Exif\x00\x00")) {
        return null;
    }
    $tiff = substr($app1, 6);
    $little = str_starts_with($tiff, 'II');
    $read = function (int $at, int $bytes) use ($tiff, $little): ?int {
        return $at >= 0 && $at + $bytes <= strlen($tiff)
            ? unpack($bytes === 2 ? ($little ? 'v' : 'n') : ($little ? 'V' : 'N'), $tiff, $at)[1]
            : null;
    };
    $ifd = $read(4, 4);
    $count = $ifd === null ? 0 : (int) $read($ifd, 2);
    for ($i = 0; $i < $count; $i++) {
        $entry = $ifd + 2 + 12 * $i;
        if ($read($entry, 2) === 0x0112) {
            $value = $read($entry + 8, 2);
            return $value !== null && $value >= 1 && $value <= 8 ? $value : null;
        }
    }
    return null;
}

/** A PNG without its text and Exif chunks (and anything after the end
    chunk), or null when the file structure is broken. */
function strip_png_metadata(string $png): ?string
{
    if (!str_starts_with($png, "\x89PNG\r\n\x1A\n")) {
        return null;
    }
    $out = substr($png, 0, 8);
    for ($pos = 8; $pos + 12 <= strlen($png);) {
        $length = unpack('N', $png, $pos)[1];
        $type = substr($png, $pos + 4, 4);
        if ($pos + 12 + $length > strlen($png)) {
            return null;
        }
        if (!in_array($type, ['tEXt', 'zTXt', 'iTXt', 'eXIf'], true)) {
            $out .= substr($png, $pos, $length + 12);
        }
        $pos += $length + 12;
        if ($type === 'IEND') {
            return $out;
        }
    }
    return null;
}

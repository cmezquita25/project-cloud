<?php
require __DIR__ . '/bootstrap.php';
$pdo = \ProjectCloud\Core\Database::pdo();

$stmt = $pdo->query("SELECT path, size_bytes, user_id FROM assets_metadata");
$files = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "<pre>";
echo "Archivos en DB:\n";
print_r($files);

$settings = new \ProjectCloud\Repositories\SettingsRepository();
$folderName = $settings->get('assets_folder_name') ?: 'assets';
$storage = rtrim((string) \ProjectCloud\Core\Config::get('storage.path', ''), '/\\');
$root = dirname($storage) . DIRECTORY_SEPARATOR . $folderName;

echo "\nChequeando existencia física en: $root\n";
foreach ($files as $f) {
    $abs = $root . '/' . ltrim($f['path'], '/');
    echo "Ruta absoluta calculada: $abs\n";
    if (is_file($abs)) {
        echo " -> Existe. Tamaño físico: " . filesize($abs) . " bytes\n";
    } else {
        echo " -> NO ENCONTRADO.\n";
    }
}
echo "</pre>";

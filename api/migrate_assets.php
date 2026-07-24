<?php
require __DIR__ . '/bootstrap.php';
$pdo = \ProjectCloud\Core\Database::pdo();

// 1. Añadir columna si no existe
try {
    $pdo->exec("ALTER TABLE assets_metadata ADD COLUMN size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0");
    echo "Columna size_bytes añadida a assets_metadata.\n";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate column') !== false) {
        echo "Columna size_bytes ya existe.\n";
    } else {
        throw $e;
    }
}

// 2. Establecer assets_quota_bytes por defecto si no existe
try {
    $pdo->exec("INSERT IGNORE INTO settings (`key`, `value`) VALUES ('assets_quota_bytes', '1073741824')");
    echo "assets_quota_bytes registrado en settings.\n";
} catch (PDOException $e) {
    echo "Error settings: " . $e->getMessage() . "\n";
}

// 3. Recalcular tamaños de los archivos existentes en la Unidad Compartida
$settings = new \ProjectCloud\Repositories\SettingsRepository();
$folderName = $settings->get('assets_folder_name') ?: 'assets';
$storage = rtrim((string) \ProjectCloud\Core\Config::get('storage.path', ''), '/\\');
$root = dirname($storage) . DIRECTORY_SEPARATOR . $folderName;

if (is_dir($root)) {
    $stmt = $pdo->query("SELECT path FROM assets_metadata");
    $updateStmt = $pdo->prepare("UPDATE assets_metadata SET size_bytes = ? WHERE path = ?");
    
    $updated = 0;
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $abs = $root . '/' . ltrim($row['path'], '/');
        if (is_file($abs)) {
            $size = filesize($abs) ?: 0;
            $updateStmt->execute([$size, $row['path']]);
            $updated++;
        }
    }
    echo "Se actualizaron $updated archivos en assets_metadata.\n";
} else {
    echo "La carpeta root de assets no existe o no está activada ($root).\n";
}
echo "Migración completada.\n";

<?php
require 'api/bootstrap.php';
$pdo = \ProjectCloud\Core\Database::pdo();
$u = $pdo->query('SELECT id, username, used_bytes, (SELECT SUM(size_bytes) FROM files WHERE user_id = users.id AND deleted_at IS NULL) as real_used FROM users')->fetchAll(PDO::FETCH_ASSOC);
print_r($u);

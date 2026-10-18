# Migraciones versionadas

Cada archivo `NNNN_descripcion.php` lleva el esquema a la versión `NNNN` y devuelve
una función que recibe el `PDO`:

```php
<?php

declare(strict_types=1);

return static function (PDO $pdo): void {
    $exists = $pdo->query("SHOW TABLES LIKE 'share_links'")->rowCount() > 0;
    if (!$exists) {
        $pdo->exec('CREATE TABLE share_links ( … )');
    }
};
```

Reglas:

- **Solo añadir:** tablas, columnas con valor por defecto, índices. No borrar ni
  renombrar. Así, revertir el código a la versión anterior sin restaurar la base
  de datos es seguro.
- **Idempotentes:** comprobar antes de aplicar.
- El número de la última migración es el `schema` de `version.json`.
- Si una versión necesita algo destructivo, márcalo en sus notas de release con
  `"migrations": { "reversible": false }`. El actualizador exigirá entonces una copia
  de seguridad y no ofrecerá «Revertir».

Las ejecuta `MigrationRunner` durante la actualización (y el botón «Aplicar
migraciones» de Base de datos).

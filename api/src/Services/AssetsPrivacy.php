<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Core\HttpException;

/**
 * Carpetas privadas en la unidad compartida (opt-in, por carpeta).
 *
 * Todo es público por defecto (sus URL directas se usan en sitios y
 * documentos). Una carpeta privada lleva un `.htaccess` de la plataforma que
 * prohíbe a Apache servir su contenido directamente: sus archivos solo salen
 * por PHP (enlaces firmados de la app y enlaces compartidos). Nada se mueve:
 * rutas, enlaces y miniaturas siguen igual, el marcador viaja con la carpeta
 * al moverla o renombrarla, y hacerla pública lo borra (las URL vuelven a
 * funcionar tal cual).
 *
 * Lo de dentro hereda: una carpeta dentro de una privada es privada.
 */
final class AssetsPrivacy
{
    private const MARKER = '.htaccess';
    private const SIGNATURE = '# Project Cloud: carpeta privada';

    /** @var array<string,bool> */
    private array $dirCache = [];

    public function __construct(private readonly AssetsService $assets)
    {
    }

    /** ¿Esta carpeta (ruta absoluta) es privada por sí misma? */
    public function isPrivateDir(string $absDir): bool
    {
        if (isset($this->dirCache[$absDir])) {
            return $this->dirCache[$absDir];
        }
        $marker = $absDir . DIRECTORY_SEPARATOR . self::MARKER;
        $private = false;
        if (is_file($marker)) {
            $head = (string) @file_get_contents($marker, false, null, 0, 200);
            $private = str_starts_with($head, self::SIGNATURE);
        }
        return $this->dirCache[$absDir] = $private;
    }

    /**
     * ¿El elemento es privado? (él mismo, si es carpeta, o alguna carpeta que
     * lo contiene).
     */
    public function isPrivatePath(string $relative, bool $isDir): bool
    {
        $segments = array_values(array_filter(explode('/', str_replace('\\', '/', $relative)), static fn ($s) => $s !== ''));
        if (!$isDir) {
            array_pop($segments);
        }
        while ($segments !== []) {
            if ($this->isPrivateDir($this->assets->resolve(implode('/', $segments)))) {
                return true;
            }
            array_pop($segments);
        }
        return false;
    }

    /**
     * Hace privada o pública una carpeta.
     *
     * @return array{files:int,check:string} check: blocked | exposed | unknown
     */
    public function set(string $relative, bool $private): array
    {
        $rel = trim(str_replace('\\', '/', $relative), '/');
        if ($rel === '') {
            throw HttpException::badRequest('La raíz de la unidad compartida no se puede hacer privada: elige una carpeta.');
        }
        foreach (explode('/', $rel) as $segment) {
            if ($segment === '' || $segment[0] === '.') {
                throw HttpException::badRequest('Carpeta no válida.');
            }
        }
        $abs = $this->assets->resolve($rel);
        if (!is_dir($abs)) {
            throw HttpException::notFound('Carpeta no encontrada.');
        }
        $parent = dirname($rel) === '.' ? '' : dirname($rel);
        if (!$private && $parent !== '' && $this->isPrivatePath($parent, true)) {
            throw new HttpException(409, 'VISIBILITY_INHERITED', 'Esta carpeta está dentro de una carpeta privada: haz pública la carpeta superior.');
        }

        $marker = $abs . DIRECTORY_SEPARATOR . self::MARKER;
        if ($private) {
            if (is_file($marker) && !$this->isPrivateDir($abs)) {
                throw new HttpException(409, 'HTACCESS_EXISTS', 'La carpeta ya tiene un .htaccess propio: no se puede hacer privada sin reemplazarlo.');
            }
            if (@file_put_contents($marker, self::htaccess(), LOCK_EX) === false) {
                throw new HttpException(500, 'FS_ERROR', 'No se pudo proteger la carpeta.');
            }
        } elseif ($this->isPrivateDir($abs)) {
            if (!@unlink($marker)) {
                throw new HttpException(500, 'FS_ERROR', 'No se pudo quitar la protección de la carpeta.');
            }
        }
        unset($this->dirCache[$abs]);

        $files = 0;
        $sample = null;
        foreach ($this->filesUnder($abs) as $file) {
            $files++;
            $sample ??= $file;
        }
        $check = $private && $sample !== null ? $this->probe($rel . '/' . str_replace('\\', '/', substr($sample, strlen($abs) + 1))) : 'unknown';
        return ['files' => $files, 'check' => $check];
    }

    /** @return \Generator<string> archivos (no ocultos) bajo la carpeta */
    private function filesUnder(string $abs): \Generator
    {
        $it = new \RecursiveIteratorIterator(new \RecursiveCallbackFilterIterator(
            new \RecursiveDirectoryIterator($abs, \FilesystemIterator::SKIP_DOTS),
            static fn (\SplFileInfo $f) => $f->getFilename()[0] !== '.'
        ));
        foreach ($it as $f) {
            /** @var \SplFileInfo $f */
            if ($f->isFile()) {
                yield $f->getPathname();
            }
        }
    }

    /**
     * Comprueba de verdad que el servidor ya no sirve la URL directa (por si
     * el hosting sirviera los archivos sin respetar .htaccess).
     */
    private function probe(string $fileRel): string
    {
        if (!function_exists('curl_init')) {
            return 'unknown';
        }
        $url = $this->assets->publicUrl($fileRel);
        if (!preg_match('#^https?://#i', $url)) {
            $url = SpaShell::origin() . $url;
        }
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_NOBODY         => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_TIMEOUT        => 6,
            CURLOPT_CONNECTTIMEOUT => 4,
        ]);
        curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        if (in_array($code, [401, 403, 404], true)) {
            return 'blocked';
        }
        return $code >= 200 && $code < 300 ? 'exposed' : 'unknown';
    }

    private static function htaccess(): string
    {
        return self::SIGNATURE . "\n"
            . "# Sus archivos solo se sirven desde la plataforma (enlaces firmados o compartidos).\n"
            . "# No lo edites: se borra al hacer la carpeta pública desde la plataforma.\n"
            . "<IfModule mod_authz_core.c>\n    Require all denied\n</IfModule>\n"
            . "<IfModule !mod_authz_core.c>\n    Order deny,allow\n    Deny from all\n</IfModule>\n";
    }
}

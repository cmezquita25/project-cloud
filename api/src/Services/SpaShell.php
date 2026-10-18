<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use ProjectCloud\Core\Request;
use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\FolderRepository;
use ProjectCloud\Repositories\SettingsRepository;
use ProjectCloud\Repositories\ShareLinkRepository;
use ProjectCloud\Services\ShareLinks\LinkKeys;
use ProjectCloud\Services\ShareLinks\LinkSettings;

/**
 * Pone en el index.html del frontend el nombre de la organización (título y
 * etiquetas para vistas previas) antes de enviarlo.
 *
 * WhatsApp, Telegram, Slack, Teams… leen el HTML de un enlace sin ejecutar
 * JavaScript: con el index.html estático la vista previa decía «Project Cloud»
 * aunque la organización tuviera otro nombre. En un enlace compartido abierto
 * (sin contraseña ni límite de visitas) la vista previa muestra además el
 * nombre del archivo o carpeta y, si es una imagen, su miniatura.
 *
 * Nunca debe romper la carga de la app: ante cualquier error se envía el HTML
 * tal cual.
 */
final class SpaShell
{
    public static function render(string $html, string $path, string $origin): string
    {
        $settings = new SettingsRepository();
        $org = trim((string) ($settings->get('organization_name') ?: ''));
        $site = $org !== '' ? $org : 'Drive';
        $slogan = trim((string) ($settings->get('organization_slogan') ?: ''));

        $title = $org !== '' ? "{$org} - Drive" : 'Drive';
        $description = $slogan !== '' ? $slogan : "Almacenamiento en la nube de {$site}.";
        $image = $settings->get('logo_favicon') ? $origin . '/api/v1/settings/logo/favicon' : null;
        $ogTitle = $site;

        if (preg_match('#^/s/([0-9A-Za-z]{22})/?$#', $path, $m) === 1) {
            $share = self::shareMeta($m[1], $origin);
            if ($share !== null) {
                $ogTitle = $share['title'];
                $title = "{$share['title']} - {$site}";
                $description = $share['description'] . " · {$site}";
                $image = $share['image'] ?? $image;
            }
        }

        $e = static fn (string $v): string => htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $tags = [
            '<meta property="og:site_name" content="' . $e($site) . '" />',
            '<meta property="og:title" content="' . $e($ogTitle) . '" />',
            '<meta property="og:description" content="' . $e($description) . '" />',
            '<meta property="og:type" content="website" />',
            '<meta name="twitter:card" content="' . ($image !== null ? 'summary_large_image' : 'summary') . '" />',
        ];
        if ($image !== null) {
            $tags[] = '<meta property="og:image" content="' . $e($image) . '" />';
        }
        // Los enlaces compartidos no deben indexarse en buscadores.
        if (str_starts_with($path, '/s/')) {
            $tags[] = '<meta name="robots" content="noindex, nofollow" />';
        }

        $html = (string) preg_replace('#<title>.*?</title>#s', '<title>' . $e($title) . '</title>', $html, 1);
        $html = (string) preg_replace('#<meta name="description"[^>]*>#', '<meta name="description" content="' . $e($description) . '" />', $html, 1);
        return (string) preg_replace('#</head>#', '    ' . implode("\n    ", $tags) . "\n  </head>", $html, 1);
    }

    /**
     * Datos de la vista previa de un enlace. Los protegidos (contraseña, solo
     * miembros, límite de visitas) no revelan el nombre. No cuenta visitas.
     *
     * @return array{title:string,description:string,image:?string}|null
     */
    private static function shareMeta(string $token, string $origin): ?array
    {
        if (!LinkKeys::isToken($token) || !LinkSettings::get()['enabled']) {
            return null;
        }
        $link = (new ShareLinkRepository())->findByToken($token);
        if ($link === null || $link['revoked_at'] !== null || (int) $link['is_expired'] === 1) {
            return null;
        }
        $isFolder = $link['target_type'] === 'folder';
        $kind = $isFolder ? 'Carpeta compartida' : 'Archivo compartido';
        if ($link['password_hash'] !== null || $link['access'] !== 'anyone' || $link['max_views'] !== null) {
            return ['title' => 'Enlace protegido', 'description' => $kind, 'image' => null];
        }

        if ($link['scope'] === 'org') {
            $name = basename((string) $link['target_path']);
            $mime = $isFolder ? null : (string) (@mime_content_type((new AssetsService())->resolve((string) $link['target_path'])) ?: '');
        } else {
            $row = $isFolder
                ? (new FolderRepository())->findAnyById((int) $link['target_id'])
                : (new FileRepository())->findAnyById((int) $link['target_id']);
            if ($row === null) {
                return null;
            }
            $name = (string) $row['name'];
            $mime = $isFolder ? null : (string) ($row['mime_type'] ?? '');
        }

        $image = $mime !== null && str_starts_with($mime, 'image/') && !str_contains($mime, 'svg')
            ? $origin . '/api/v1/public/links/' . $token . '/thumb?s=600'
            : null;
        return ['title' => $name, 'description' => $kind, 'image' => $image];
    }

    /** https://dominio (tras un proxy, respeta X-Forwarded-Proto). */
    public static function origin(): string
    {
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
        $host = preg_replace('/[^A-Za-z0-9.:\-\[\]]/', '', (string) ($_SERVER['HTTP_HOST'] ?? 'localhost'));
        return ($https ? 'https' : 'http') . '://' . $host;
    }
}

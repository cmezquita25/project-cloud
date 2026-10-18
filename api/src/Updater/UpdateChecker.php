<?php

declare(strict_types=1);

namespace ProjectCloud\Updater;

use PDO;
use ProjectCloud\Core\AppVersion;
use ProjectCloud\Core\Database;
use ProjectCloud\Core\HttpException;
use ProjectCloud\Repositories\NotificationRepository;
use ProjectCloud\Repositories\SettingsRepository;

/**
 * Consulta el servidor de versiones y recuerda si hay una actualización.
 *
 * La consulta es anónima: solo descarga manifest.json. El manifiesto se
 * verifica (firma Ed25519) antes de creerse nada de lo que dice.
 */
final class UpdateChecker
{
    public const DEFAULT_SERVER_URL = 'https://techmaleon.com.mx/project-cloud/manifest.json';
    public const CHECK_INTERVAL_SECONDS = 12 * 3600;
    private const MANIFEST_MAX_BYTES = 1024 * 1024;

    private SettingsRepository $settings;

    public function __construct(?SettingsRepository $settings = null)
    {
        $this->settings = $settings ?? new SettingsRepository();
    }

    public function serverUrl(): string
    {
        $url = trim((string) $this->settings->get('update_server_url', ''));
        return $url !== '' ? $url : self::DEFAULT_SERVER_URL;
    }

    /**
     * Descarga y verifica el manifiesto. Añade `package_url` (absoluta).
     *
     * @return array<string,mixed>
     */
    public function fetchManifest(): array
    {
        $url = $this->serverUrl();
        $body = HttpClient::get($url, 15, self::MANIFEST_MAX_BYTES);
        $manifest = json_decode($body, true);
        if (!is_array($manifest)) {
            throw new HttpException(502, 'UPDATE_MANIFEST_INVALID', 'El servidor de actualizaciones no devolvió un manifiesto válido.');
        }
        ReleaseVerifier::verifyManifest($manifest);
        $manifest['package_url'] = HttpClient::resolve($url, (string) $manifest['package']['url']);
        return $manifest;
    }

    /**
     * Consulta ahora. Guarda el resultado y avisa a los admins (una vez por versión).
     *
     * @return array<string,mixed> Estado en caché tras la consulta.
     */
    public function check(): array
    {
        $this->settings->set('update_last_check', gmdate('c'));
        try {
            $manifest = $this->fetchManifest();
            $this->settings->delete('update_last_error');

            if (self::isNewer((string) $manifest['version'], AppVersion::current())) {
                $this->settings->set('update_available', (string) json_encode($manifest, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
                $this->notifyAdmins($manifest);
            } else {
                $this->settings->delete('update_available');
            }
        } catch (\Throwable $e) {
            $this->settings->set('update_last_error', mb_substr($e->getMessage(), 0, 300));
        }
        return $this->cachedStatus();
    }

    /** Consulta solo si la última fue hace más de 12 h (sin lanzar errores). */
    public function checkIfStale(): void
    {
        $last = $this->settings->get('update_last_check');
        if ($last === null || (time() - (int) strtotime($last)) >= self::CHECK_INTERVAL_SECONDS) {
            $this->check();
        }
    }

    /** @return array{last_check:?string,last_error:?string,available:?array<string,mixed>} */
    public function cachedStatus(): array
    {
        $available = null;
        $raw = $this->settings->get('update_available');
        if ($raw !== null) {
            $decoded = json_decode($raw, true);
            // Si ya se instaló (o se instaló a mano una versión igual o mayor), no se ofrece.
            if (is_array($decoded) && self::isNewer((string) ($decoded['version'] ?? '0'), AppVersion::current())) {
                $available = $decoded;
            }
        }
        return [
            'last_check' => $this->settings->get('update_last_check'),
            'last_error' => $this->settings->get('update_last_error'),
            'available'  => $available,
        ];
    }

    public static function isNewer(string $candidate, string $current): bool
    {
        return version_compare($candidate, $current, '>');
    }

    /** @param array<string,mixed> $manifest */
    private function notifyAdmins(array $manifest): void
    {
        $version = (string) $manifest['version'];
        if ($this->settings->get('update_notified_version') === $version) {
            return;
        }
        $this->settings->set('update_notified_version', $version);

        $pdo = Database::pdo();
        $admins = $pdo->query("SELECT id FROM users WHERE role = 'admin' AND status = 'active'")->fetchAll(PDO::FETCH_COLUMN);
        $first = $manifest['changelog'][0]['text'] ?? 'Hay una nueva versión de la plataforma.';
        $repo = new NotificationRepository($pdo);
        foreach ($admins as $id) {
            $repo->create(
                (int) $id,
                null,
                'system.update_available',
                "Actualización disponible: v{$version}",
                (string) $first,
                '/admin/settings/updates'
            );
        }
    }
}

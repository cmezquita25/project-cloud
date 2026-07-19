<?php

declare(strict_types=1);

namespace ProjectCloud\Services;

use RuntimeException;

/**
 * Cliente SMTP mínimo y autocontenido (sin Composer / sin dependencias).
 *
 * Cubre lo que necesita la plataforma: SSL implícito (465), STARTTLS (587),
 * AUTH LOGIN/PLAIN y envío de un mensaje MIME ya construido. Es un transporte
 * intercambiable: MailService construye el mensaje y delega aquí el diálogo SMTP.
 * Si en el futuro se vendoriza PHPMailer, basta con sustituir esta clase sin
 * tocar el resto del núcleo de correo.
 */
final class SmtpMailer
{
    /** @var resource|null */
    private $socket = null;

    public function __construct(
        private readonly string $host,
        private readonly int $port,
        private readonly string $username,
        private readonly string $password,
        private readonly string $encryption = 'tls', // tls | ssl | none
        private readonly int $timeout = 15,
    ) {
    }

    /** Abre la conexión, saluda (EHLO), negocia TLS y autentica. Lanza en error. */
    public function connect(): void
    {
        $useImplicitSsl = strtolower($this->encryption) === 'ssl';
        $remote = ($useImplicitSsl ? 'ssl://' : '') . $this->host . ':' . $this->port;

        // Modo tolerante con certificados: los relays SMTP auto-hospedados (p. ej.
        // el propio Plesk) suelen usar certificados self-signed. Se prioriza que
        // "funcione" el envío; el canal sigue cifrado.
        $context = stream_context_create([
            'ssl' => [
                'verify_peer'       => false,
                'verify_peer_name'  => false,
                'allow_self_signed' => true,
            ],
        ]);

        $errno = 0;
        $errstr = '';
        $this->socket = @stream_socket_client(
            $remote,
            $errno,
            $errstr,
            $this->timeout,
            STREAM_CLIENT_CONNECT,
            $context,
        );
        if ($this->socket === false) {
            $this->socket = null;
            throw new RuntimeException("No se pudo conectar a {$this->host}:{$this->port} — {$errstr} ({$errno})");
        }
        stream_set_timeout($this->socket, $this->timeout);

        $this->expect(220);
        $host = $this->clientHostname();
        $this->ehlo($host);

        if (strtolower($this->encryption) === 'tls') {
            $this->command('STARTTLS', 220);
            $crypto = STREAM_CRYPTO_METHOD_TLS_CLIENT;
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) {
                $crypto |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
            }
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_1_CLIENT')) {
                $crypto |= STREAM_CRYPTO_METHOD_TLSv1_1_CLIENT;
            }
            if (@stream_socket_enable_crypto($this->socket, true, $crypto) !== true) {
                throw new RuntimeException('No se pudo iniciar el cifrado TLS (STARTTLS).');
            }
            // Tras STARTTLS hay que volver a saludar sobre el canal cifrado.
            $this->ehlo($host);
        }

        if ($this->username !== '') {
            $this->authenticate();
        }
    }

    /** Envía un mensaje MIME ya construido (cabeceras + cuerpo). */
    public function send(string $fromEmail, string $toEmail, string $rawMessage): void
    {
        if ($this->socket === null) {
            throw new RuntimeException('SMTP no conectado.');
        }
        $this->command('MAIL FROM:<' . $fromEmail . '>', 250);
        $this->command('RCPT TO:<' . $toEmail . '>', 250);
        $this->command('DATA', 354);

        // "Dot-stuffing": una línea que empiece por '.' debe duplicarse.
        $body = preg_replace('/^\./m', '..', $rawMessage) ?? $rawMessage;
        fwrite($this->socket, $body . "\r\n.\r\n");
        $this->expect(250);
    }

    public function close(): void
    {
        if ($this->socket !== null) {
            try {
                fwrite($this->socket, "QUIT\r\n");
            } catch (\Throwable) {
                // Cierre best-effort.
            }
            fclose($this->socket);
            $this->socket = null;
        }
    }

    // --- Internos ---

    private function authenticate(): void
    {
        // AUTH LOGIN (usuario y contraseña en base64, el más compatible).
        $this->command('AUTH LOGIN', 334);
        $this->command(base64_encode($this->username), 334);
        $this->command(base64_encode($this->password), 235);
    }

    private function ehlo(string $host): void
    {
        if ($this->socket === null) {
            throw new RuntimeException('SMTP no conectado.');
        }
        fwrite($this->socket, "EHLO {$host}\r\n");
        [$code] = $this->readResponse();
        if ($code !== 250) {
            // Servidores antiguos: reintenta con HELO.
            fwrite($this->socket, "HELO {$host}\r\n");
            $this->expect(250);
        }
    }

    private function command(string $command, int $expected): string
    {
        if ($this->socket === null) {
            throw new RuntimeException('SMTP no conectado.');
        }
        fwrite($this->socket, $command . "\r\n");
        return $this->expect($expected);
    }

    private function expect(int $expected): string
    {
        [$code, $data] = $this->readResponse();
        if ($code !== $expected) {
            throw new RuntimeException("Respuesta SMTP inesperada (se esperaba {$expected}): " . trim($data));
        }
        return $data;
    }

    /** @return array{0:int,1:string} [código, texto completo] */
    private function readResponse(): array
    {
        if ($this->socket === null) {
            throw new RuntimeException('SMTP no conectado.');
        }
        $data = '';
        while (($line = fgets($this->socket, 515)) !== false) {
            $data .= $line;
            // En respuestas multilínea el 4º carácter es '-'; ' ' marca la última.
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
            $meta = stream_get_meta_data($this->socket);
            if (!empty($meta['timed_out'])) {
                throw new RuntimeException('Tiempo de espera agotado leyendo la respuesta SMTP.');
            }
        }
        $code = (int) substr($data, 0, 3);
        return [$code, $data];
    }

    private function clientHostname(): string
    {
        $name = gethostname();
        if (is_string($name) && $name !== '') {
            return $name;
        }
        return 'localhost';
    }
}

<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Services\ActivityLogger;
use ProjectCloud\Services\ShareLinks\LinkSettings;
use ProjectCloud\Services\ShareLinks\PublicLinkService;
use ProjectCloud\Services\ShareLinks\ShareLinkService;

/**
 * Enlaces compartidos y QR (Fase 6).
 *
 *   /v1/links…              lado del que comparte (con sesión)
 *   /v1/public/links/{t}…   lado del visitante (sin sesión, solo lectura)
 */
final class ShareLinkController
{
    // --- Con sesión ---

    /** GET /links?scope=&target_type=&target_id=|target_path= — enlaces de un elemento. */
    public function index(Request $request): Response
    {
        return Response::success((new ShareLinkService())->listForTarget($this->actor($request), [
            'scope'       => $request->input('scope', 'drive'),
            'target_type' => $request->input('target_type'),
            'target_id'   => $request->input('target_id'),
            'target_path' => $request->input('target_path'),
        ]));
    }

    /** POST /links — crea un enlace. */
    public function create(Request $request): Response
    {
        $link = (new ShareLinkService())->create($this->actor($request), $request->json());
        ActivityLogger::log($request, 'link.create', $link['target_type'], $link['target_id'], [
            'link_id' => $link['id'],
            'access'  => $link['access'],
            'path'    => $link['target_path'],
        ]);
        return Response::created($link);
    }

    /** PATCH /links/{id} — acceso, caducidad, etiqueta, contraseña, descarga. */
    public function update(Request $request): Response
    {
        $body = $request->json();
        $link = (new ShareLinkService())->update($this->actor($request), (int) $request->param('id'), $body);
        ActivityLogger::log($request, 'link.update', $link['target_type'], $link['target_id'], [
            'link_id' => $link['id'],
            'fields'  => array_values(array_intersect(array_keys($body), ['access', 'label', 'allow_download', 'expires_in', 'password'])),
        ]);
        return Response::success($link);
    }

    /** DELETE /links/{id} — revoca (el enlace responde 410 desde ese momento). */
    public function revoke(Request $request): Response
    {
        $link = (new ShareLinkService())->revoke($this->actor($request), (int) $request->param('id'));
        ActivityLogger::log($request, 'link.revoke', $link['target_type'], $link['target_id'], ['link_id' => $link['id']]);
        return Response::success($link);
    }

    /** GET /links/mine?status=&q=&page= — «Mis enlaces compartidos». */
    public function mine(Request $request): Response
    {
        return Response::success((new ShareLinkService())->panel($this->actor($request), $this->panelQuery($request), false));
    }

    /** GET /admin/links?status=&q=&user_id=&page= — todos los enlaces de la instancia. */
    public function adminIndex(Request $request): Response
    {
        return Response::success((new ShareLinkService())->panel($this->actor($request), $this->panelQuery($request), true));
    }

    /** POST /links/revoke { ids } | { all: true, confirm: "REVOCAR" } — los míos. */
    public function revokeMine(Request $request): Response
    {
        return $this->bulkRevoke($request, false);
    }

    /** POST /admin/links/revoke { ids } | { all: true, confirm: "REVOCAR" } — de toda la instancia. */
    public function adminRevoke(Request $request): Response
    {
        return $this->bulkRevoke($request, true);
    }

    /** GET /links/{id}/hits — últimos accesos. */
    public function hits(Request $request): Response
    {
        return Response::success(['hits' => (new ShareLinkService())->hits($this->actor($request), (int) $request->param('id'))]);
    }

    /** GET /admin/links/policy */
    public function policy(Request $request): Response
    {
        return Response::success(LinkSettings::get());
    }

    /** PUT /admin/links/policy { enabled, max_expiry_days, allow_never, allow_anyone } */
    public function savePolicy(Request $request): Response
    {
        $policy = LinkSettings::save($request->json());
        ActivityLogger::log($request, 'links.policy', 'config', null, $policy);
        return Response::success($policy);
    }

    private function bulkRevoke(Request $request, bool $admin): Response
    {
        $body = $request->json();
        $all = (bool) ($body['all'] ?? false);
        if ($all && ($body['confirm'] ?? '') !== 'REVOCAR') {
            throw new HttpException(422, 'CONFIRM_REQUIRED', 'Escribe REVOCAR para confirmar.');
        }
        $ids = $all ? null : array_values(array_filter(array_map('intval', (array) ($body['ids'] ?? []))));
        if (!$all && $ids === []) {
            throw new HttpException(400, 'BAD_REQUEST', 'No seleccionaste enlaces.');
        }
        $count = (new ShareLinkService())->revokeMany($this->actor($request), $ids, $admin);
        ActivityLogger::log($request, 'link.revoke_many', 'link', null, ['count' => $count, 'all' => $all, 'instance' => $admin && $all]);
        return Response::success(['revoked' => $count]);
    }

    /** @return array<string,mixed> */
    private function panelQuery(Request $request): array
    {
        return [
            'status'  => $request->input('status', 'active'),
            'q'       => $request->input('q', ''),
            'user_id' => $request->input('user_id'),
            'page'    => $request->input('page', 1),
            'limit'   => $request->input('limit', 20),
        ];
    }

    // --- Público ---

    /** GET /public/links/{token} */
    public function open(Request $request): Response
    {
        return $this->publicJson((new PublicLinkService())->open((string) $request->param('token'), $request));
    }

    /** POST /public/links/{token}/unlock { password } */
    public function unlock(Request $request): Response
    {
        return $this->publicJson(['key' => (new PublicLinkService())->unlock((string) $request->param('token'), $request)]);
    }

    /** GET /public/links/{token}/items?folder= */
    public function items(Request $request): Response
    {
        return $this->publicJson((new PublicLinkService())->items((string) $request->param('token'), $request));
    }

    /** GET /public/links/{token}/content?f=&download=1 */
    public function content(Request $request): void
    {
        $this->publicHeaders();
        (new PublicLinkService())->content((string) $request->param('token'), $request);
    }

    /** GET /public/links/{token}/thumb?f= */
    public function thumb(Request $request): void
    {
        $this->publicHeaders();
        (new PublicLinkService())->thumb((string) $request->param('token'), $request);
    }

    // --- Ayudantes ---

    /** @return array{id:int,role:string} */
    private function actor(Request $request): array
    {
        return ['id' => (int) $request->userId(), 'role' => (string) ($request->user()['role'] ?? 'user')];
    }

    private function publicJson(array $data): Response
    {
        return Response::success($data)
            ->withHeader('Cache-Control', 'no-store')
            ->withHeader('X-Robots-Tag', 'noindex, nofollow')
            ->withHeader('Referrer-Policy', 'no-referrer');
    }

    /** Para los binarios (se envían con header() directo, no con Response). */
    private function publicHeaders(): void
    {
        header('X-Robots-Tag: noindex, nofollow');
        header('Referrer-Policy: no-referrer');
    }
}

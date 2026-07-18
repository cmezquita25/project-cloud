<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Repositories\FileRepository;
use ProjectCloud\Repositories\UserRepository;
use ProjectCloud\Services\QuotaService;

/**
 * Uso de almacenamiento del usuario autenticado.
 */
final class QuotaController
{
    /** GET /quota */
    public function index(Request $request): Response
    {
        $service = new QuotaService(new UserRepository(), new FileRepository());
        return Response::success($service->usage((int) $request->userId()));
    }
}

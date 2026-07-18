<?php

declare(strict_types=1);

namespace ProjectCloud\Controllers;

use ProjectCloud\Core\HttpException;
use ProjectCloud\Core\Request;
use ProjectCloud\Core\Response;
use ProjectCloud\Core\Validator;
use ProjectCloud\Repositories\ActivityRepository;
use ProjectCloud\Repositories\RefreshTokenRepository;
use ProjectCloud\Repositories\UserRepository;
use ProjectCloud\Services\AuthService;

/**
 * Endpoints de autenticación: login, refresh, logout, me.
 */
final class AuthController
{
    private function service(): AuthService
    {
        return new AuthService(new UserRepository(), new RefreshTokenRepository());
    }

    /** POST /auth/login */
    public function login(Request $request): Response
    {
        $data = (new Validator($request->json()))
            ->required('login')
            ->required('password')
            ->validate();

        $result = $this->service()->login(
            (string) $data['login'],
            (string) $data['password'],
            $request->userAgent(),
            $request->ip(),
        );

        try {
            (new ActivityRepository())->log(
                (int) $result['user']['id'],
                'login',
                null,
                null,
                null,
                $request->ip(),
            );
        } catch (\Throwable) {
            // la auditoría no debe romper el login
        }

        return Response::success($result);
    }

    /** POST /auth/refresh */
    public function refresh(Request $request): Response
    {
        $data = (new Validator($request->json()))
            ->required('refresh_token')
            ->validate();

        $result = $this->service()->refresh(
            (string) $data['refresh_token'],
            $request->userAgent(),
            $request->ip(),
        );

        return Response::success($result);
    }

    /** POST /auth/logout */
    public function logout(Request $request): Response
    {
        $token = $request->input('refresh_token');
        if (is_string($token) && $token !== '') {
            $this->service()->logout($token);
        }
        return Response::success(['ok' => true]);
    }

    /** GET /auth/me (requiere AuthMiddleware) */
    public function me(Request $request): Response
    {
        $userId = $request->userId();
        if ($userId === null) {
            throw HttpException::unauthorized();
        }
        $user = (new UserRepository())->findById($userId);
        if ($user === null) {
            throw HttpException::unauthorized('Usuario no encontrado');
        }
        return Response::success(AuthService::publicUser($user));
    }
}

<?php

declare(strict_types=1);

namespace ProjectCloud\Core;

/**
 * Enrutador simple con parámetros `{param}` y middlewares por ruta.
 *
 * Handlers admitidos:
 *   - Closure:  fn(Request $r): Response
 *   - [Clase::class, 'metodo'] : el método recibe (Request) y devuelve Response
 */
final class Router
{
    /** @var list<array{method:string,regex:string,handler:mixed,middleware:list<Middleware>}> */
    private array $routes = [];

    /** @param list<Middleware> $middleware */
    public function get(string $pattern, mixed $handler, array $middleware = []): void
    {
        $this->add('GET', $pattern, $handler, $middleware);
    }

    /** @param list<Middleware> $middleware */
    public function post(string $pattern, mixed $handler, array $middleware = []): void
    {
        $this->add('POST', $pattern, $handler, $middleware);
    }

    /** @param list<Middleware> $middleware */
    public function patch(string $pattern, mixed $handler, array $middleware = []): void
    {
        $this->add('PATCH', $pattern, $handler, $middleware);
    }

    /** @param list<Middleware> $middleware */
    public function put(string $pattern, mixed $handler, array $middleware = []): void
    {
        $this->add('PUT', $pattern, $handler, $middleware);
    }

    /** @param list<Middleware> $middleware */
    public function delete(string $pattern, mixed $handler, array $middleware = []): void
    {
        $this->add('DELETE', $pattern, $handler, $middleware);
    }

    /** @param list<Middleware> $middleware */
    public function add(string $method, string $pattern, mixed $handler, array $middleware = []): void
    {
        $this->routes[] = [
            'method'     => $method,
            'regex'      => $this->compile($pattern),
            'handler'    => $handler,
            'middleware' => $middleware,
        ];
    }

    /** Convierte "/folders/{id}/children" en una regex con grupos nombrados. */
    private function compile(string $pattern): string
    {
        $regex = preg_replace('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', '(?P<$1>[^/]+)', $pattern);
        return '#^' . $regex . '$#';
    }

    public function dispatch(Request $request): Response
    {
        $methodAllowed = false;

        foreach ($this->routes as $route) {
            if (preg_match($route['regex'], $request->path, $matches) !== 1) {
                continue;
            }
            if ($route['method'] !== $request->method) {
                $methodAllowed = true; // la ruta existe pero con otro método
                continue;
            }

            // Extrae parámetros de ruta con nombre.
            foreach ($matches as $key => $value) {
                if (is_string($key)) {
                    $request->params[$key] = $value;
                }
            }

            // Ejecuta middlewares (pueden lanzar HttpException).
            foreach ($route['middleware'] as $mw) {
                $mw->handle($request);
            }

            return $this->invoke($route['handler'], $request);
        }

        if ($methodAllowed) {
            throw new HttpException(405, 'METHOD_NOT_ALLOWED', 'Método no permitido para esta ruta');
        }
        throw HttpException::notFound('Ruta no encontrada: ' . $request->path);
    }

    private function invoke(mixed $handler, Request $request): Response
    {
        if (is_array($handler)) {
            [$class, $method] = $handler;
            $instance = is_object($class) ? $class : new $class();
            /** @var Response $result */
            $result = $instance->$method($request);
            return $result;
        }

        /** @var callable $handler */
        return $handler($request);
    }
}

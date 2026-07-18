<?php

declare(strict_types=1);

namespace ProjectCloud\Core;

/**
 * Validador encadenable para los datos de entrada.
 *
 * Uso:
 *   $data = (new Validator($request->json()))
 *       ->required('email')->email('email')
 *       ->required('password')->minLength('password', 8)
 *       ->validate(); // lanza HttpException(422) si hay errores
 */
final class Validator
{
    /** @var array<string,list<string>> */
    private array $errors = [];

    /** @param array<string,mixed> $data */
    public function __construct(private readonly array $data)
    {
    }

    public function required(string $field, ?string $label = null): self
    {
        $value = $this->data[$field] ?? null;
        if ($value === null || $value === '' || (is_array($value) && $value === [])) {
            $this->addError($field, ($label ?? $field) . ' es obligatorio');
        }
        return $this;
    }

    public function email(string $field): self
    {
        $value = $this->data[$field] ?? null;
        if (is_string($value) && $value !== '' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
            $this->addError($field, 'Correo electrónico inválido');
        }
        return $this;
    }

    public function minLength(string $field, int $min): self
    {
        $value = $this->data[$field] ?? null;
        if (is_string($value) && mb_strlen($value) < $min) {
            $this->addError($field, "Debe tener al menos $min caracteres");
        }
        return $this;
    }

    public function maxLength(string $field, int $max): self
    {
        $value = $this->data[$field] ?? null;
        if (is_string($value) && mb_strlen($value) > $max) {
            $this->addError($field, "No debe superar $max caracteres");
        }
        return $this;
    }

    /** @param list<string> $allowed */
    public function in(string $field, array $allowed): self
    {
        $value = $this->data[$field] ?? null;
        if ($value !== null && !in_array($value, $allowed, true)) {
            $this->addError($field, 'Valor no permitido');
        }
        return $this;
    }

    public function matches(string $field, string $pattern, string $message): self
    {
        $value = $this->data[$field] ?? null;
        if (is_string($value) && $value !== '' && preg_match($pattern, $value) !== 1) {
            $this->addError($field, $message);
        }
        return $this;
    }

    public function integer(string $field): self
    {
        $value = $this->data[$field] ?? null;
        if ($value !== null && filter_var($value, FILTER_VALIDATE_INT) === false) {
            $this->addError($field, 'Debe ser un número entero');
        }
        return $this;
    }

    private function addError(string $field, string $message): void
    {
        $this->errors[$field][] = $message;
    }

    public function fails(): bool
    {
        return $this->errors !== [];
    }

    /** @return array<string,list<string>> */
    public function errors(): array
    {
        return $this->errors;
    }

    /**
     * Devuelve los datos validados o lanza HttpException(422) con los errores.
     *
     * @return array<string,mixed>
     */
    public function validate(): array
    {
        if ($this->fails()) {
            throw HttpException::validation($this->errors);
        }
        return $this->data;
    }
}

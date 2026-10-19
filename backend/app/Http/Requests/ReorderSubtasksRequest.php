<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReorderSubtasksRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'subtask_ids' => 'required|array',
            'subtask_ids.*' => 'required|integer|exists:tasks,id',
        ];
    }
}

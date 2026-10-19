<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSubtaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'priority' => 'sometimes|nullable|string|in:Thấp,Bình thường,Cao,Khẩn cấp',
            'complexity' => 'sometimes|nullable|string|in:XS,S,M,L,XL,xs,s,m,l,xl',
            'is_completed' => 'sometimes|nullable|boolean',
            'completed_at' => 'sometimes|nullable',
            'start_date' => 'sometimes|nullable|date',
            'due_date' => 'sometimes|nullable|date',
            'assignee_ids' => 'sometimes|nullable|array',
            'assignee_ids.*' => 'integer|exists:users,id',
            'task_group_id' => 'sometimes|nullable|integer',
            'sort_order' => 'sometimes|nullable|integer',
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Tiêu đề công việc con không được để trống.',
            'title.max' => 'Tiêu đề công việc con không được vượt quá 255 ký tự.',
            'priority.in' => 'Mức độ ưu tiên không hợp lệ.',
            'due_date.date' => 'Ngày đến hạn không đúng định dạng.',
            'start_date.date' => 'Ngày bắt đầu không đúng định dạng.',
        ];
    }
}

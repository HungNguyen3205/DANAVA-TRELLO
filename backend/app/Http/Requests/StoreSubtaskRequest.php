<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSubtaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'priority' => 'nullable|string|in:Thấp,Bình thường,Cao,Khẩn cấp',
            'complexity' => 'nullable|string|in:XS,S,M,L,XL,xs,s,m,l,xl',
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'assignee_ids' => 'nullable|array',
            'assignee_ids.*' => 'integer|exists:users,id',
            'task_group_id' => 'nullable|integer',
            'copy_parent_assignees' => 'sometimes|boolean',
            'sort_order' => 'nullable|integer',
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
            'assignee_ids.array' => 'Danh sách người thực hiện phải là một mảng.',
            'assignee_ids.*.exists' => 'Người thực hiện được chọn không tồn tại.',
        ];
    }
}

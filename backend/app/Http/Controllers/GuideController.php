<?php

namespace App\Http\Controllers;

use App\Support\UserGuide;

/** The user guide shown on the "Hướng dẫn sử dụng" page (the assistant uses the same content). */
class GuideController extends Controller
{
    public function index()
    {
        return response()->json(['sections' => UserGuide::all()]);
    }
}

#!/bin/bash
set -e
cd /home/faqih/projects/latihan/quizary/backend
source venv/bin/activate

echo "=== 1. Route list (all registered endpoints) ==="
python -c "
from app.main import app
routes = [(r.methods, r.path) for r in app.routes if hasattr(r, 'methods')]
for m, p in sorted(routes, key=lambda x: x[1]):
    print(f'  {sorted(m)} {p}')
"

echo ""
echo "=== 2. Schema consistency check ==="
python -c "
from app.schemas.form import FormCreate, FormUpdate, FormPublishRequest
from app.schemas.question import QuestionCreate, QuestionUpdate, ReorderRequest
from app.schemas.submissions import SubmissionCreateRequest, AutosaveRequest, SubmissionCreateResponse, SubmissionDetailResponse
from app.schemas.auth import RegisterRequest, LoginRequest, UserResponse, TokenResponse
from app.schemas.results import ResultItem, AnalyticsResponse, DashboardResponse
from app.schemas.profile import ProfileUpdateRequest
print('  All schemas OK')
"

echo ""
echo "=== 3. Check for bare except / unhandled None risks in submissions ==="
grep -n "form\.ends_at\|form\.starts_at\|sub\.started_at" app/routers/submissions.py | head -20

echo ""
echo "=== 4. Verify all upload dirs exist ==="
python -c "
import os
dirs = ['uploads/banners', 'uploads/question-images', 'uploads/avatars']
for d in dirs:
    exists = os.path.isdir(d)
    print(f'  {d}: {\"OK\" if exists else \"MISSING\"}')
"

echo "=== Done ==="

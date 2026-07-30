#!/bin/bash
set -e
cd /home/faqih/projects/latihan/quizary/backend
source venv/bin/activate

python -c "
from app.database import engine
from sqlalchemy import text
from datetime import datetime

with engine.connect() as conn:
    row = conn.execute(text('SELECT @@session.time_zone, NOW(), UTC_TIMESTAMP()')).fetchone()
    print('=== After fix: MySQL session timezone ===')
    print(f'  session tz   : {row[0]}')
    print(f'  NOW()        : {row[1]}')
    print(f'  UTC_TIMESTAMP: {row[2]}')
    print(f'  Match        : {str(row[1]) == str(row[2])}')

    # Check existing form data
    rows = conn.execute(text('SELECT id, starts_at, ends_at FROM forms LIMIT 3')).fetchall()
    print()
    print('=== Form datetime values in DB =====')
    for r in rows:
        print(f'  id={r[0]} starts_at={r[1]!r} ends_at={r[2]!r}')

    from app.database import SessionLocal
    db = SessionLocal()
    from app.models.form import Form
    form = db.query(Form).first()
    if form and form.starts_at:
        from app.utils import to_naive_utc
        starts = to_naive_utc(form.starts_at)
        now = datetime.utcnow()
        print()
        print('=== Comparison test ===')
        print(f'  starts_at (naive): {starts}')
        print(f'  utcnow           : {now}')
        print(f'  now < starts?    : {now < starts}  (should reflect reality)')
    db.close()
" 2>&1 | grep -v DeprecationWarning

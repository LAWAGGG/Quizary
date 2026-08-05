#!/bin/bash
set -e
cd /home/faqih/projects/latihan/quizary

echo "=== Frontend lint check ==="
cd frontend
npm run lint 2>&1 | tail -30

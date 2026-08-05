#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /home/faqih/projects/latihan/quizary/frontend
node_modules/.bin/oxlint \
  src/pages/public/AnswerQuiz.jsx \
  src/pages/public/QuizResult.jsx \
  src/components/ui/Card.jsx \
  2>&1 | head -60

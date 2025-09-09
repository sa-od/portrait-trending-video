@echo off
echo Setting up AI Video Title Generator...
echo.

echo Installing Node.js dependencies...
npm install

echo.
echo Creating environment file...
if not exist .env (
    copy env.example .env
    echo Please edit .env file and add your OpenAI API key
) else (
    echo .env file already exists
)

echo.
echo Note: Directories will be created automatically in temp folder when needed

echo.
echo Setup complete!
echo.
echo Next steps:
echo 1. Edit .env file and add your OpenAI API key
echo 2. Install FFmpeg and add to PATH
echo 3. Run: npm run dev
echo 4. Open index.html in your browser
echo.
pause

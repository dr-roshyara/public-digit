#!/bin/bash
# File: install.sh

echo "Setting up Knowledge-Based CLI with DeepSeek API"

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install requirements
pip install requests

# Make CLI executable
chmod +x knowledge_cli.py

# Create symlink for easy access
ln -sf "$(pwd)/knowledge_cli.py" /usr/local/bin/knowledge-cli

echo "Installation complete!"
echo ""
echo "Usage:"
echo "  knowledge-cli develop \"Your task here\""
echo "  knowledge-cli search \"query\""
echo "  knowledge-cli list"
echo "  knowledge-cli setup-api-key YOUR_DEEPSEEK_API_KEY"
echo ""
echo "Get your API key from: https://platform.deepseek.com/api_keys"
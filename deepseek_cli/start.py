# File: start.py
#!/usr/bin/env python3
"""
Simple starter script for interactive CLI
"""

import os
import sys

def main():
    # Check if interactive_cli.py exists
    if not os.path.exists("interactive_cli.py"):
        print("❌ interactive_cli.py not found!")
        print("Please make sure interactive_cli.py is in the same directory.")
        print("You can copy the code from the instructions above.")
        return
    
    # Check API key
    if not os.getenv("DEEPSEEK_API_KEY"):
        config_path = os.path.join(".knowledge", "config.json")
        if os.path.exists(config_path):
            print("✓ Using API key from config file")
        else:
            print("⚠️  No API key found.")
            print("You can:")
            print("1. Set environment variable: set DEEPSEEK_API_KEY=your_key")
            print("2. Use /setup command in the CLI")
            print("3. Run python setup_interactive.py")
    
    # Import and run
    try:
        from interactive_cli import main as start_cli
        start_cli()
    except ImportError as e:
        print(f"❌ Error: {e}")
        print("Make sure all dependencies are installed:")
        print("pip install colorama requests")

if __name__ == "__main__":
    main()
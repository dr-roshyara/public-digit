# File: setup_interactive.py
#!/usr/bin/env python3
"""
Setup script for interactive CLI
"""

import subprocess
import sys
import os

def check_and_install():
    """Check dependencies and install if needed"""
    print("🔧 Setting up Interactive Knowledge CLI...")
    
    # Check Python version
    python_version = sys.version_info
    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 7):
        print("❌ Python 3.7+ is required")
        return False
    
    # Check/install colorama
    try:
        import colorama
        print("✅ colorama already installed")
    except ImportError:
        print("Installing colorama...")
        result = subprocess.run([sys.executable, "-m", "pip", "install", "colorama"],
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ colorama installed")
        else:
            print(f"❌ Failed to install colorama: {result.stderr}")
            return False
    
    # Check/install requests
    try:
        import requests
        print("✅ requests already installed")
    except ImportError:
        print("Installing requests...")
        result = subprocess.run([sys.executable, "-m", "pip", "install", "requests"],
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ requests installed")
        else:
            print(f"❌ Failed to install requests: {result.stderr}")
            return False
    
    return True

def setup_api_key():
    """Setup API key if not set"""
    if not os.getenv("DEEPSEEK_API_KEY"):
        print("\n🔑 API Key Setup:")
        print("Get your API key from: https://platform.deepseek.com/api_keys")
        
        api_key = input("Enter your DeepSeek API key (or press Enter to skip): ").strip()
        
        if api_key:
            # Save to config
            import json
            from pathlib import Path
            
            knowledge_dir = Path(".knowledge")
            knowledge_dir.mkdir(exist_ok=True)
            config_file = knowledge_dir / "config.json"
            
            config = {"api_key": api_key}
            with open(config_file, 'w') as f:
                json.dump(config, f, indent=2)
            
            print("✅ API key saved to config file")
            
            # Also set environment variable for current session
            os.environ["DEEPSEEK_API_KEY"] = api_key
            print("✅ Environment variable set for this session")
        else:
            print("⚠️  Skipping API key setup. You can set it later with /setup command")
    
    print("\n🎉 Setup complete!")

def main():
    if check_and_install():
        setup_api_key()
        print("\n🚀 Starting Interactive CLI...")
        print("Run: python interactive_cli.py")
        
        # Ask if user wants to start
        start_now = input("\nStart interactive CLI now? (y/n): ").lower().strip()
        if start_now == 'y':
            # Import and run after file is created
            print("\nStarting...")
            
            # Check if interactive_cli.py exists
            if os.path.exists("interactive_cli.py"):
                # Use subprocess to run it
                subprocess.run([sys.executable, "interactive_cli.py"])
            else:
                print("❌ interactive_cli.py not found!")
                print("Please save the interactive_cli.py code first.")
    else:
        print("❌ Setup failed. Please check the errors above.")

if __name__ == "__main__":
    main()
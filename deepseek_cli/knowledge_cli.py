# File: interactive_cli.py
#!/usr/bin/env python3
"""
Interactive Knowledge-Based CLI with DeepSeek API
Like Claude Desktop but with knowledge accumulation
"""

import os
import json
import sys
import readline  # For better input handling
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import requests
from colorama import init, Fore, Style, Back

# Initialize colorama for cross-platform colored text
init(autoreset=True)

class InteractiveKnowledgeCLI:
    """Interactive CLI with chat-like interface"""
    
    def __init__(self):
        self.knowledge_dir = Path(".knowledge")
        self.knowledge_file = self.knowledge_dir / "knowledge_base.json"
        self.config_file = self.knowledge_dir / "config.json"
        self.api_key = None
        self.deepseek = None
        self.conversation_history = []
        self.current_context = []
        
        self.setup_directories()
        self.load_api_key()
        self.print_welcome()
    
    def setup_directories(self):
        """Setup required directories"""
        self.knowledge_dir.mkdir(exist_ok=True)
        
        if not self.knowledge_file.exists():
            self.save_knowledge({
                "summary": [],
                "core_instructions": {},
                "api_interactions": [],
                "conversations": []
            })
    
    def load_api_key(self):
        """Load API key from config or env"""
        # Check environment
        self.api_key = os.getenv("DEEPSEEK_API_KEY")
        
        # Check config file
        if not self.api_key and self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    self.api_key = config.get("api_key")
            except:
                pass
        
        if self.api_key:
            self.deepseek = DeepSeekAPI(self.api_key)
            return True
        return False
    
    def save_knowledge(self, data: Dict):
        """Save knowledge to file"""
        with open(self.knowledge_file, 'w') as f:
            json.dump(data, f, indent=2)
    
    def load_knowledge(self) -> Dict:
        """Load existing knowledge"""
        try:
            with open(self.knowledge_file, 'r') as f:
                return json.load(f)
        except:
            return {"summary": [], "core_instructions": {}, "api_interactions": [], "conversations": []}
    
    def search_knowledge(self, query: str) -> List[Dict]:
        """Search through existing knowledge"""
        knowledge = self.load_knowledge()
        results = []
        query_lower = query.lower()
        
        for topic, instructions in knowledge["core_instructions"].items():
            if (query_lower in topic.lower() or 
                query_lower in instructions["instructions"].lower()):
                results.append({
                    "type": "core_instructions",
                    "topic": topic,
                    "content": instructions
                })
        
        return results
    
    def add_to_knowledge(self, query: str, response: str):
        """Add conversation to knowledge base"""
        knowledge = self.load_knowledge()
        
        # Add conversation
        conversation = {
            "timestamp": datetime.now().isoformat(),
            "query": query[:500],
            "response": response[:1000],
            "context": self.current_context.copy() if self.current_context else []
        }
        
        if "conversations" not in knowledge:
            knowledge["conversations"] = []
        knowledge["conversations"].append(conversation)
        
        # Extract and save core instructions
        lines = response.split('\n')
        core_points = []
        
        # Look for numbered lists or bullet points
        for line in lines:
            if (line.strip().startswith(('1.', '2.', '3.', '4.', '5.', '- ', '* ', '• ')) or
                'key point' in line.lower() or 'important:' in line.lower()):
                core_points.append(line.strip())
                if len(core_points) >= 3:
                    break
        
        if core_points:
            topic = query[:50] + ("..." if len(query) > 50 else "")
            knowledge["core_instructions"][topic] = {
                "timestamp": datetime.now().isoformat(),
                "instructions": "\n".join(core_points),
                "usage_count": 1,
                "source_conversation": len(knowledge["conversations"]) - 1
            }
        
        self.save_knowledge(knowledge)
    
    def print_welcome(self):
        """Print welcome banner"""
        print(Fore.CYAN + "=" * 60)
        print(Fore.YELLOW + "🤖 Interactive Knowledge-Based CLI")
        print(Fore.CYAN + "=" * 60)
        print(Fore.GREEN + "Welcome! Type your questions/tasks below.")
        print(Fore.MAGENTA + "Commands:")
        print(Fore.WHITE + "  /help     - Show this help")
        print(Fore.WHITE + "  /clear    - Clear conversation")
        print(Fore.WHITE + "  /context  - Show current context")
        print(Fore.WHITE + "  /search   - Search knowledge base")
        print(Fore.WHITE + "  /list     - List all knowledge")
        print(Fore.WHITE + "  /save     - Save current conversation")
        print(Fore.WHITE + "  /exit     - Exit the CLI")
        print(Fore.CYAN + "=" * 60)
        
        if self.deepseek:
            print(Fore.GREEN + "✓ API Key loaded: Ready to use DeepSeek")
        else:
            print(Fore.RED + "⚠️  No API Key found. Using local knowledge only.")
            print(Fore.YELLOW + "Set DEEPSEEK_API_KEY env var or use /setup")
        print()
    
    def process_command(self, user_input: str):
        """Process user input and commands"""
        if user_input.startswith('/'):
            self.handle_slash_command(user_input[1:])
            return None
        else:
            return self.handle_user_query(user_input)
    
    def handle_slash_command(self, command: str):
        """Handle slash commands"""
        cmd_parts = command.split()
        cmd = cmd_parts[0].lower()
        
        if cmd == "help":
            self.print_welcome()
        elif cmd == "clear":
            self.conversation_history = []
            self.current_context = []
            print(Fore.GREEN + "✓ Conversation cleared")
        elif cmd == "context":
            if self.current_context:
                print(Fore.CYAN + "📚 Current Context:")
                for i, ctx in enumerate(self.current_context, 1):
                    print(Fore.WHITE + f"  {i}. {ctx}")
            else:
                print(Fore.YELLOW + "No context set")
        elif cmd == "search" and len(cmd_parts) > 1:
            query = ' '.join(cmd_parts[1:])
            results = self.search_knowledge(query)
            if results:
                print(Fore.GREEN + f"🔍 Found {len(results)} results:")
                for result in results[:5]:  # Show first 5
                    print(Fore.CYAN + f"  • {result['topic']}")
                    print(Fore.WHITE + f"    {result['content']['instructions'][:100]}...")
            else:
                print(Fore.YELLOW + "No results found")
        elif cmd == "list":
            knowledge = self.load_knowledge()
            print(Fore.CYAN + "📊 Knowledge Base Stats:")
            print(Fore.WHITE + f"  Conversations: {len(knowledge.get('conversations', []))}")
            print(Fore.WHITE + f"  Core Instructions: {len(knowledge.get('core_instructions', {}))}")
            if knowledge.get('core_instructions'):
                print(Fore.CYAN + "  Recent Topics:")
                for topic in list(knowledge['core_instructions'].keys())[-5:]:
                    print(Fore.WHITE + f"    • {topic}")
        elif cmd == "save":
            if self.conversation_history:
                self.save_conversation()
                print(Fore.GREEN + "✓ Conversation saved to knowledge base")
            else:
                print(Fore.YELLOW + "No conversation to save")
        elif cmd == "setup" and len(cmd_parts) > 1:
            self.setup_api_key(cmd_parts[1])
        elif cmd == "exit":
            print(Fore.YELLOW + "👋 Goodbye!")
            sys.exit(0)
        else:
            print(Fore.RED + f"Unknown command: /{cmd}")
            print(Fore.YELLOW + "Type /help for available commands")
    
    def save_conversation(self):
        """Save current conversation to knowledge base"""
        knowledge = self.load_knowledge()
        
        if self.conversation_history:
            conversation_record = {
                "timestamp": datetime.now().isoformat(),
                "history": self.conversation_history.copy(),
                "context": self.current_context.copy()
            }
            
            if "conversations" not in knowledge:
                knowledge["conversations"] = []
            knowledge["conversations"].append(conversation_record)
            self.save_knowledge(knowledge)
    
    def setup_api_key(self, api_key: str):
        """Setup API key"""
        config = {"api_key": api_key}
        with open(self.config_file, 'w') as f:
            json.dump(config, f, indent=2)
        
        self.api_key = api_key
        self.deepseek = DeepSeekAPI(api_key)
        print(Fore.GREEN + "✓ API key saved and configured")
    
    def handle_user_query(self, query: str) -> Optional[str]:
        """Handle user query with knowledge-first approach"""
        print(Fore.CYAN + "\n" + "=" * 60)
        print(Fore.YELLOW + "🤔 Processing your query...")
        
        # Step 1: Search existing knowledge
        if self.current_context:
            print(Fore.GREEN + "📚 Using conversation context...")
            context = "\n".join(self.current_context[-3:])  # Last 3 context items
        else:
            results = self.search_knowledge(query)
            if results:
                print(Fore.GREEN + f"🔍 Found {len(results)} relevant knowledge entries")
                context = "\n".join([
                    f"{r['topic']}: {r['content']['instructions'][:200]}"
                    for r in results[:2]  # Use top 2 results
                ])
            else:
                context = ""
                print(Fore.YELLOW + "🔍 No relevant knowledge found")
        
        # Step 2: Prepare prompt
        if self.deepseek:
            if context:
                prompt = f"""Context from previous knowledge:
{context}

Current query: {query}

Please provide a comprehensive response as a senior developer."""
            else:
                prompt = f"""Query: {query}

Please provide a comprehensive response as a senior developer."""
            
            # Step 3: Query DeepSeek
            print(Fore.BLUE + "🤖 Querying DeepSeek API...")
            try:
                response = self.deepseek.query(prompt)
                
                # Step 4: Add to context
                self.conversation_history.append({"role": "user", "content": query})
                self.conversation_history.append({"role": "assistant", "content": response})
                
                # Keep context manageable (last 3 exchanges)
                if len(self.current_context) > 6:
                    self.current_context = self.current_context[-6:]
                
                self.current_context.append(f"User: {query[:100]}...")
                self.current_context.append(f"Assistant: {response[:200]}...")
                
                # Step 5: Save to knowledge base
                self.add_to_knowledge(query, response)
                
                return response
            except Exception as e:
                error_msg = f"API Error: {str(e)}"
                print(Fore.RED + f"❌ {error_msg}")
                return error_msg
        else:
            error_msg = "No API key configured. Use /setup <api_key> to set up."
            print(Fore.RED + f"❌ {error_msg}")
            return error_msg
    
    def run(self):
        """Main interactive loop"""
        try:
            while True:
                try:
                    # Get user input with prompt
                    user_input = input(Fore.MAGENTA + "\n💭 You: " + Style.RESET_ALL).strip()
                    
                    if not user_input:
                        continue
                    
                    # Process input
                    response = self.process_command(user_input)
                    
                    # Print response if any
                    if response:
                        print(Fore.GREEN + "\n" + "=" * 60)
                        print(Fore.CYAN + "🤖 Assistant:" + Style.RESET_ALL)
                        print(response)
                        print(Fore.GREEN + "=" * 60)
                        
                except KeyboardInterrupt:
                    print(Fore.YELLOW + "\n\n🛑 Use /exit to quit properly")
                except EOFError:
                    print(Fore.YELLOW + "\n👋 Goodbye!")
                    break
                except Exception as e:
                    print(Fore.RED + f"\n❌ Error: {str(e)}")
        
        finally:
            # Auto-save on exit
            if self.conversation_history:
                self.save_conversation()
                print(Fore.GREEN + "✓ Conversation auto-saved")


class DeepSeekAPI:
    """Handle DeepSeek API interactions"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.deepseek.com/v1/chat/completions"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def query(self, prompt: str) -> str:
        """Query DeepSeek API"""
        messages = [{"role": "user", "content": prompt}]
        
        payload = {
            "model": "deepseek-chat",
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 4000
        }
        
        try:
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json=payload,
                timeout=60
            )
            response.raise_for_status()
            
            result = response.json()
            return result["choices"][0]["message"]["content"]
            
        except requests.exceptions.RequestException as e:
            return f"API Error: {str(e)}"
        except (KeyError, json.JSONDecodeError):
            return "Error: Invalid API response format"


def main():
    """Main entry point"""
    cli = InteractiveKnowledgeCLI()
    cli.run()


if __name__ == "__main__":
    main()
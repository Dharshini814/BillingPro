import os
import json
import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class AIProvider(ABC):
    """Abstract base class for AI providers."""

    @abstractmethod
    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict]] = None,
        temperature: float = 0.3,
        max_tokens: int = 1000,
    ) -> Dict[str, Any]:
        """Generate a response from the AI model."""
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Check if the provider is properly configured."""
        pass


class OpenAIProvider(AIProvider):
    """OpenAI API provider."""

    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY") or os.getenv("AI_API_KEY")
        self.model = os.getenv("AI_MODEL", "gpt-4o-mini")
        self.client = None
        if self.api_key:
            try:
                from openai import AsyncOpenAI
                self.client = AsyncOpenAI(api_key=self.api_key)
            except ImportError:
                logger.warning("openai package not installed")

    def is_configured(self) -> bool:
        return self.client is not None

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict]] = None,
        temperature: float = 0.3,
        max_tokens: int = 1000,
    ) -> Dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("OpenAI provider not configured. Set OPENAI_API_KEY or AI_API_KEY.")

        try:
            kwargs = {
                "model": self.model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "auto"

            response = await self.client.chat.completions.create(**kwargs)
            return {
                "content": response.choices[0].message.content or "",
                "tool_calls": response.choices[0].message.tool_calls,
            }
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise


class AnthropicProvider(AIProvider):
    """Anthropic (Claude) API provider."""

    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("AI_API_KEY")
        self.model = os.getenv("AI_MODEL", "claude-3-haiku-20240307")
        self.client = None
        if self.api_key:
            try:
                from anthropic import AsyncAnthropic
                self.client = AsyncAnthropic(api_key=self.api_key)
            except ImportError:
                logger.warning("anthropic package not installed")

    def is_configured(self) -> bool:
        return self.client is not None

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict]] = None,
        temperature: float = 0.3,
        max_tokens: int = 1000,
    ) -> Dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("Anthropic provider not configured. Set ANTHROPIC_API_KEY or AI_API_KEY.")

        try:
            # Convert messages format for Anthropic
            system_prompt = ""
            anthropic_messages = []
            for msg in messages:
                if msg["role"] == "system":
                    system_prompt = msg["content"]
                else:
                    anthropic_messages.append({"role": msg["role"], "content": msg["content"]})

            kwargs = {
                "model": self.model,
                "messages": anthropic_messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if system_prompt:
                kwargs["system"] = system_prompt
            if tools:
                # Anthropic uses a different tool format
                kwargs["tools"] = self._convert_tools_for_anthropic(tools)

            response = await self.client.messages.create(**kwargs)

            # Extract content and tool calls
            content = ""
            tool_calls = []
            for block in response.content:
                if block.type == "text":
                    content += block.text
                elif block.type == "tool_use":
                    tool_calls.append({
                        "id": block.id,
                        "name": block.name,
                        "arguments": block.input,
                    })

            return {
                "content": content,
                "tool_calls": tool_calls if tool_calls else None,
            }
        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            raise

    def _convert_tools_for_anthropic(self, tools: List[Dict]) -> List[Dict]:
        """Convert OpenAI-style tools to Anthropic format."""
        converted = []
        for tool in tools:
            if tool.get("type") == "function":
                fn = tool["function"]
                converted.append({
                    "name": fn["name"],
                    "description": fn.get("description", ""),
                    "input_schema": fn.get("parameters", {"type": "object", "properties": {}}),
                })
        return converted


class GeminiProvider(AIProvider):
    """Google Gemini API provider."""

    def __init__(self):
        self.api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("AI_API_KEY")
        self.model = os.getenv("AI_MODEL", "gemini-1.5-flash")
        self.client = None
        if self.api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                self.client = genai.GenerativeModel(self.model)
            except ImportError:
                logger.warning("google-generativeai package not installed")

    def is_configured(self) -> bool:
        return self.client is not None

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict]] = None,
        temperature: float = 0.3,
        max_tokens: int = 1000,
    ) -> Dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("Gemini provider not configured. Set GOOGLE_API_KEY or AI_API_KEY.")

        try:
            # Convert messages to Gemini format
            system_instruction = ""
            gemini_messages = []
            for msg in messages:
                if msg["role"] == "system":
                    system_instruction = msg["content"]
                elif msg["role"] == "user":
                    gemini_messages.append({"role": "user", "parts": [msg["content"]]})
                elif msg["role"] == "assistant":
                    gemini_messages.append({"role": "model", "parts": [msg["content"]]})

            # Gemini doesn't support tools in the same way, so we'll include tool descriptions in the prompt
            if tools:
                tool_desc = "\n\nAvailable tools:\n"
                for tool in tools:
                    if tool.get("type") == "function":
                        fn = tool["function"]
                        tool_desc += f"- {fn['name']}: {fn.get('description', '')}\n"
                        params = fn.get("parameters", {})
                        if params.get("properties"):
                            tool_desc += f"  Parameters: {json.dumps(params['properties'])}\n"
                if gemini_messages:
                    gemini_messages[0]["parts"][0] += tool_desc

            generation_config = {
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            }

            if system_instruction:
                response = await self.client.generate_content_async(
                    [system_instruction] + [msg["parts"][0] for msg in gemini_messages],
                    generation_config=generation_config,
                )
            else:
                response = await self.client.generate_content_async(
                    [msg["parts"][0] for msg in gemini_messages],
                    generation_config=generation_config,
                )

            return {
                "content": response.text or "",
                "tool_calls": None,  # Tool calling not implemented for Gemini in this version
            }
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            raise


class MockProvider(AIProvider):
    """Mock provider for development/testing without API keys."""

    def is_configured(self) -> bool:
        return True

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict]] = None,
        temperature: float = 0.3,
        max_tokens: int = 1000,
    ) -> Dict[str, Any]:
        # Return a structured mock response based on the last user message
        last_user_msg = ""
        for msg in reversed(messages):
            if msg["role"] == "user":
                last_user_msg = msg["content"].lower()
                break

        # Check if a tool was already called in this conversation (to avoid infinite loops)
        tools_already_called = set()
        for msg in messages:
            if msg.get("role") == "tool":
                tools_already_called.add(msg.get("name"))

        # Check if tools would be invoked based on keywords
        if tools:
            for tool in tools:
                if tool.get("type") == "function":
                    fn_name = tool["function"]["name"]
                    # Skip if this tool was already called
                    if fn_name in tools_already_called:
                        continue
                    if self._should_invoke_tool(last_user_msg, fn_name):
                        return {
                            "content": "",
                            "tool_calls": [{
                                "id": f"mock_call_{len(tools_already_called) + 1}",
                                "name": fn_name,
                                "arguments": self._get_mock_arguments(fn_name, last_user_msg),
                            }],
                        }

        # Generate contextual mock response
        return {
            "content": self._generate_mock_response(last_user_msg, messages),
            "tool_calls": None,
        }

    def _should_invoke_tool(self, message: str, tool_name: str) -> bool:
        """Determine if a tool should be invoked based on the message."""
        tool_keywords = {
            "get_customer_subscriptions": ["subscription", "plan", "subscriptions"],
            "get_customer_invoices": ["invoice", "invoices", "bill", "bills", "unpaid", "overdue"],
            "get_customer_payments": ["payment", "payments", "transaction", "paid ", "payed"],  # Note: "paid " with space to avoid matching "unpaid"
            "get_customer_latest_invoice": ["latest invoice", "recent invoice", "last invoice"],
            "get_customer_billing_summary": ["summary", "overview", "total spent", "billing history"],
            "get_admin_dashboard_summary": ["admin", "summary", "total customers", "mrr", "churn", "revenue", "monthly revenue", "total revenue", "this month", "month revenue", "business metrics", "kpi", "dashboard"],
            "get_admin_revenue_by_plan": ["revenue by plan", "plan revenue", "revenue per plan"],
            "get_admin_subscription_metrics": ["subscription metrics", "subscription status", "active subscriptions", "how many subscriptions", "subscription count", "active subs"],
            "get_admin_failed_payments": ["failed payments", "failed payment"],
            "get_admin_expiring_subscriptions": ["expiring", "expiring soon", "renewal"],
            "find_customer_by_email": ["find customer", "customer email", "lookup customer"],
        }
        keywords = tool_keywords.get(tool_name, [])
        return any(kw in message for kw in keywords)

    def _get_mock_arguments(self, tool_name: str, message: str) -> Dict:
        """Generate mock arguments for a tool call."""
        # For customer tools, we don't need customer_id as it's derived from auth
        if tool_name == "find_customer_by_email":
            # Extract email from message
            import re
            email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', message)
            if email_match:
                return {"email": email_match.group(0)}
        elif tool_name == "get_admin_expiring_subscriptions":
            # Extract days if mentioned
            import re
            days_match = re.search(r'(\d+)\s*days?', message)
            if days_match:
                return {"days": int(days_match.group(1))}
        return {}

    def _generate_mock_response(self, message: str, messages: List[Dict] = None) -> str:
        """Generate a contextual mock response, incorporating tool results if available."""
        if not message:
            return "Hello! I'm your BillingPro AI assistant. How can I help you with your billing questions?"

        # If there are tool results in the conversation, incorporate them
        if messages:
            for msg in reversed(messages):
                if msg.get("role") == "tool":
                    tool_name = msg.get("name", "")
                    tool_content = msg.get("content", "")
                    try:
                        import json
                        tool_data = json.loads(tool_content) if isinstance(tool_content, str) else tool_content
                        # Generate response based on tool data
                        if tool_name == "get_admin_subscription_metrics" and isinstance(tool_data, dict):
                            return f"Based on the current data, you have {tool_data.get('active', 0)} active subscriptions, {tool_data.get('trial', 0)} trial subscriptions, {tool_data.get('past_due', 0)} past due, and {tool_data.get('cancelled', 0)} cancelled subscriptions. Total: {tool_data.get('total', 0)}."
                        elif tool_name == "get_admin_dashboard_summary" and isinstance(tool_data, dict):
                            return f"Business Summary: {tool_data.get('total_customers', 0)} total customers, {tool_data.get('active_subscriptions', 0)} active subscriptions, MRR: ${tool_data.get('mrr', 0):,.2f}, Churn rate: {tool_data.get('churn_rate', 0)}%, Trial conversion: {tool_data.get('trial_conversion_rate', 0)}%."
                        elif tool_name == "get_admin_revenue_by_plan" and isinstance(tool_data, list):
                            if tool_data:
                                lines = [f"- {item.get('plan', 'Unknown')}: ${item.get('revenue', 0):,.2f}" for item in tool_data]
                                return "Revenue by plan:\n" + "\n".join(lines)
                            return "No revenue data available for current plans."
                        elif tool_name == "get_admin_failed_payments" and isinstance(tool_data, list):
                            if tool_data:
                                lines = [f"- {item.get('customer_name', 'Unknown')} ({item.get('customer_email', 'Unknown')}): ${item.get('amount', 0):,.2f} on {item.get('payment_date', 'Unknown')}" for item in tool_data[:5]]
                                return f"Recent failed payments ({len(tool_data)} total):\n" + "\n".join(lines)
                            return "No failed payments found."
                        elif tool_name == "get_admin_expiring_subscriptions" and isinstance(tool_data, list):
                            if tool_data:
                                lines = [f"- {item.get('customer_name', 'Unknown')} ({item.get('plan_name', 'Unknown')}): renews in {item.get('days_until_renewal', '?')} days" for item in tool_data[:5]]
                                return f"Subscriptions expiring soon ({len(tool_data)} total):\n" + "\n".join(lines)
                            return "No subscriptions expiring in the specified period."
                        elif tool_name == "find_customer_by_email" and isinstance(tool_data, dict) and tool_data:
                            return f"Customer found: {tool_data.get('name', 'Unknown')} ({tool_data.get('email', 'Unknown')}) - {tool_data.get('active_subscriptions', 0)} active subscriptions, total paid: ${tool_data.get('total_paid', 0):,.2f}"
                        elif tool_name == "get_customer_invoices" and isinstance(tool_data, list):
                            if tool_data:
                                lines = []
                                for inv in tool_data:
                                    status = inv.get("status", "")
                                    status_marker = "[PAID]" if status == "paid" else "[UNPAID]" if status == "unpaid" else "[OVERDUE]"
                                    due = inv.get("due_date", "N/A")
                                    if due and due != "N/A":
                                        try:
                                            from datetime import date
                                            due_date = date.fromisoformat(due[:10])
                                            due = due_date.strftime("%b %d, %Y")
                                        except:
                                            pass
                                    lines.append(f"{status_marker} {inv.get('invoice_number', 'N/A')} - {inv.get('plan_name', 'N/A')} - Rs.{inv.get('amount', 0):,.2f} (Due: {due})")
                                return "Here are your invoices:\n\n" + "\n".join(lines)
                            return "You don't have any invoices yet."
                        elif tool_name == "get_customer_payments" and isinstance(tool_data, list):
                            if tool_data:
                                lines = []
                                for p in tool_data:
                                    status = p.get("status", "")
                                    status_marker = "[PAID]" if status == "paid" else "[FAILED]" if status == "failed" else "[PENDING]"
                                    date_str = p.get("payment_date", "N/A")
                                    if date_str and date_str != "N/A":
                                        try:
                                            from datetime import date
                                            dt = date.fromisoformat(date_str[:10])
                                            date_str = dt.strftime("%b %d, %Y")
                                        except:
                                            pass
                                    lines.append(f"{status_marker} {p.get('payment_reference', 'N/A')} - Rs.{p.get('amount', 0):,.2f} via {p.get('payment_method', 'N/A')} on {date_str}")
                                return "Your payment history:\n\n" + "\n".join(lines)
                            return "You haven't made any payments yet."
                        elif tool_name == "get_customer_subscriptions" and isinstance(tool_data, list):
                            if tool_data:
                                lines = []
                                for s in tool_data:
                                    status = s.get("status", "")
                                    status_marker = "[ACTIVE]" if status == "active" else "[TRIAL]" if status == "trial" else "[PAST DUE]"
                                    next_bill = s.get("next_billing_date", "N/A")
                                    if next_bill and next_bill != "N/A":
                                        try:
                                            from datetime import date
                                            dt = date.fromisoformat(next_bill[:10])
                                            next_bill = dt.strftime("%b %d, %Y")
                                        except:
                                            pass
                                    lines.append(f"{status_marker} {s.get('plan_name', 'N/A')} ({s.get('billing_cycle', 'N/A')}) - Rs.{s.get('amount', 0):,.2f}/month - Next billing: {next_bill}")
                                return "Your subscriptions:\n\n" + "\n".join(lines)
                            return "You don't have any active subscriptions."
                        elif tool_name == "get_customer_latest_invoice" and isinstance(tool_data, dict) and tool_data:
                            inv = tool_data
                            due = inv.get("due_date", "N/A")
                            if due and due != "N/A":
                                try:
                                    from datetime import date
                                    due_date = date.fromisoformat(due[:10])
                                    due = due_date.strftime("%b %d, %Y")
                                except:
                                    pass
                            return f"Your latest invoice: {inv.get('invoice_number', 'N/A')} for {inv.get('plan_name', 'N/A')} - Rs.{inv.get('amount', 0):,.2f} (Status: {inv.get('status', 'N/A')}, Due: {due})"
                        elif tool_name == "get_customer_billing_summary" and isinstance(tool_data, dict) and tool_data:
                            data = tool_data
                            return f"Billing Summary for {data.get('customer_name', 'you')}\n\nTotal Paid: {data.get('total_paid_formatted', 'Rs.0.00')}\nTotal Invoices: {data.get('total_invoices', 0)} (Paid: {data.get('paid_invoices', 0)}, Unpaid: {data.get('unpaid_invoices', 0)}, Overdue: {data.get('overdue_invoices', 0)})\nFailed Payments: {data.get('failed_payments', 0)}\nActive Subscriptions: {data.get('active_subscriptions', 0)}\nWallet Balance: {data.get('wallet_balance_formatted', 'Rs.0.00')}"
                        elif tool_name.startswith("get_customer_") and isinstance(tool_data, list):
                            if tool_data:
                                return f"Found {len(tool_data)} items for your request."
                            return "No data found for your request."
                        elif tool_name.startswith("get_customer_") and isinstance(tool_data, dict) and tool_data:
                            return f"Here are the details for your request."
                    except Exception:
                        pass

        # Admin-specific responses (these are fallbacks when no tools are invoked)
        admin_responses = {
            "revenue": "Based on current data, your Monthly Recurring Revenue (MRR) is $0.00 with 0 active subscriptions. Total customers: 0.",
            "total customers": "You have 0 total customers registered in the system.",
            "mrr": "Current MRR (Monthly Recurring Revenue): $0.00",
            "churn": "Churn rate: 0.00% (no subscriptions cancelled yet)",
            "subscription metrics": "Subscription status: Active: 0, Trial: 0, Past Due: 0, Cancelled: 0",
            "failed payments": "No failed payments found in recent history.",
            "expiring": "No subscriptions expiring in the next 30 days.",
            "find customer": "Please provide a customer email to look up their details.",
        }

        # Customer-specific responses
        customer_responses = {
            "subscription": "Based on your account, you currently have an active subscription. Would you like details about your plan, billing cycle, or next payment date?",
            "invoice": "Your latest invoice shows a total of $99.00 with a due date of next week. Would you like me to show you the full invoice details or payment options?",
            "payment": "Your recent payment of $99.00 was successfully processed on March 15th. Your account is up to date.",
            "billing": "Your billing summary: 3 invoices total, 2 paid, 1 pending. Total spent: $297.00. Failed payments: 0.",
            "help": "I can help you with:\n- Your current subscription and plan details\n- Invoice status and payment history\n- Upcoming billing dates\n- Payment methods and wallet balance\n\nWhat would you like to know?",
        }

        # Check admin keywords first
        for keyword, response in admin_responses.items():
            if keyword in message:
                return response

        for keyword, response in customer_responses.items():
            if keyword in message:
                return response

        return "I'm here to help with your billing questions! You can ask me about your subscriptions, invoices, payments, or billing history. What would you like to know?"


def get_ai_provider() -> AIProvider:
    """Factory function to get the configured AI provider."""
    provider_name = os.getenv("AI_PROVIDER", "mock").lower()

    if provider_name == "openai":
        return OpenAIProvider()
    elif provider_name == "anthropic":
        return AnthropicProvider()
    elif provider_name == "gemini":
        return GeminiProvider()
    else:
        logger.info(f"Using mock AI provider (AI_PROVIDER={provider_name})")
        return MockProvider()


# System prompts for different roles
CUSTOMER_SYSTEM_PROMPT = """You are BillingPro's AI assistant for customers. You help customers understand their billing, subscriptions, invoices, and payments.

IMPORTANT RULES:
1. You ONLY have access to the authenticated customer's data. Never reference other customers.
2. Use the available tools to fetch actual data from the database. Do not make up numbers, dates, or statuses.
3. If a tool returns no data, say so honestly (e.g., "You don't have any active subscriptions").
4. Be helpful, clear, and concise. Use friendly but professional language.
5. If the user asks about something outside your tools (like changing their plan), explain what you can help with and direct them to the appropriate dashboard section.
6. All monetary values should be formatted with currency (e.g., $99.00 or ₹99.00 based on customer's currency).
7. Dates should be in human-readable format (e.g., "March 15, 2024").

Available tools:
- get_customer_subscriptions: Get the customer's active subscriptions
- get_customer_invoices: Get invoices (can filter by status: unpaid, paid, all)
- get_customer_payments: Get payment history
- get_customer_latest_invoice: Get the most recent invoice
- get_customer_billing_summary: Get a summary of billing activity"""


ADMIN_SYSTEM_PROMPT = """You are BillingPro's AI assistant for administrators. You help admins understand business metrics, customer data, and billing operations.

IMPORTANT RULES:
1. You have access to AGGREGATE business data and can look up individual customers by email.
2. Use the available tools to fetch actual data from the database. Do not make up numbers.
3. Be precise with numbers and cite the data source when giving specific figures.
4. For customer-specific queries, use the find_customer_by_email tool first.
5. All monetary values in USD unless otherwise noted.
6. Dates in human-readable format.

Available tools:
- get_admin_dashboard_summary: High-level KPIs (customers, subscriptions, MRR, churn)
- get_admin_revenue_by_plan: Revenue breakdown by plan
- get_admin_subscription_metrics: Subscription status counts
- get_admin_failed_payments: List of failed payments
- get_admin_expiring_subscriptions: Subscriptions expiring soon (specify days)
- find_customer_by_email: Look up a specific customer by email"""


TOOL_DEFINITIONS_CUSTOMER = [
    {
        "type": "function",
        "function": {
            "name": "get_customer_subscriptions",
            "description": "Get the authenticated customer's active subscriptions with plan details",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_customer_invoices",
            "description": "Get the customer's invoices, optionally filtered by status",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["all", "unpaid", "paid", "overdue"], "description": "Filter invoices by status"}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_customer_payments",
            "description": "Get the customer's payment history",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_customer_latest_invoice",
            "description": "Get the customer's most recent invoice",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_customer_billing_summary",
            "description": "Get a summary of the customer's billing activity",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


TOOL_DEFINITIONS_ADMIN = [
    {
        "type": "function",
        "function": {
            "name": "get_admin_dashboard_summary",
            "description": "Get high-level business KPIs: total customers, active subscriptions, MRR, churn rate, trial conversion",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_admin_revenue_by_plan",
            "description": "Get revenue grouped by plan for active subscriptions",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_admin_subscription_metrics",
            "description": "Get subscription counts by status (active, trial, past_due, cancelled)",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_admin_failed_payments",
            "description": "Get list of recent failed payments with customer details",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_admin_expiring_subscriptions",
            "description": "Get subscriptions expiring within specified days",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "default": 30, "description": "Days ahead to check for expiring subscriptions"}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_customer_by_email",
            "description": "Find a customer by email address",
            "parameters": {
                "type": "object",
                "properties": {
                    "email": {"type": "string", "description": "Customer email to search for"}
                },
                "required": ["email"],
            },
        },
    },
]
import requests
import re
from bs4 import BeautifulSoup
import datetime
import random

class NescoClient:
    SUBMIT_TYPE_RECHARGE_HISTORY = 'রিচার্জ হিস্ট্রি'
    SUBMIT_TYPE_MONTHLY_CONSUMPTION = 'মাসিক ব্যবহার'
    BASE_URL = 'https://customer.nesco.gov.bd/pre/panel'

    def __init__(self, customer_number: str):
        self.customer_number = str(customer_number).strip()

    def is_demo(self) -> bool:
        return self.customer_number.upper().startswith("TEST") or self.customer_number.upper().startswith("DEMO")

    def fetch_all(self):
        """
        Fetches all relevant data from NESCO prepaid panel:
        Returns:
            dict containing:
                balance: float
                customer_name: str
                meter_number: str
                recharge_history: list of dicts
                monthly_consumption: list of dicts
                current_month_consumption: float
                last_reading_time: datetime
                customer_info: dict
        """
        if self.is_demo():
            return self._generate_demo_data()

        try:
            session = requests.Session()
            # Set a standard User-Agent to avoid getting blocked
            session.headers.update({
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            })

            # Step 1: GET panel page to obtain CSRF token
            get_response = session.get(self.BASE_URL, timeout=15)
            get_response.raise_for_status()

            soup = BeautifulSoup(get_response.text, 'html.parser')
            csrf_token_meta = soup.find('meta', attrs={'name': 'csrf-token'})
            csrf_token = csrf_token_meta['content'] if csrf_token_meta else None

            # Step 2: POST to fetch recharge history and basic customer info
            recharge_data = {
                '_token': csrf_token,
                'cust_no': self.customer_number,
                'submit': self.SUBMIT_TYPE_RECHARGE_HISTORY
            }

            recharge_response = session.post(self.BASE_URL, data=recharge_data, timeout=15)
            recharge_response.raise_for_status()
            recharge_html = recharge_response.text

            # Parse balance and customer info
            parsed_info = self._parse_inputs(recharge_html)
            
            if not parsed_info:
                raise ValueError("Could not parse customer info or balance. Invalid customer number or page layout changed.")

            # Extract details using exact label values for robustness
            customer_name = parsed_info.get("গ্রাহকের নাম", "Unknown Customer")
            meter_number = parsed_info.get("মিটার নম্বর", self.customer_number)
            
            # Find the balance input label, which has variable date stamp text
            balance_str = "0.0"
            for k, v in parsed_info.items():
                if "অবশিষ্ট ব্যালেন্স" in k:
                    balance_str = v
                    break

            try:
                balance = float(re.sub(r'[^\d.-]', '', balance_str))
            except ValueError:
                balance = 0.0

            # Parse recharge history table
            recharge_history = self._parse_recharge_table(recharge_html)

            # Map full customer info
            def get_val(keys):
                for k in keys:
                    if k in parsed_info:
                        return parsed_info[k]
                return ""

            customer_info = {
                "customer_name": customer_name,
                "father_husband_name": get_val(["পিতা/স্বামীর নাম"]),
                "address": get_val(["ঠিকানা"]),
                "mobile": get_val(["মোবাইল"]),
                "electricity_office": get_val(["সংশ্লিষ্ট বিদ্যুৎ অফিস"]),
                "feeder_name": get_val(["ফিডারের নাম"]),
                "consumer_number": get_val(["কনজ্যুমার নম্বর"]),
                "meter_number": meter_number,
                "approved_load": get_val(["অনুমোদিত লোড (কি.ও)", "অনুমোদিত লোড (কি.ও.)", "অনুমোদিত লোড"]),
                "approved_tariff": get_val(["অনুমোদিত ট্যারিফ"]),
                "meter_type": get_val(["মিটারের ধরণ", "মিটারের ধরন"]),
                "meter_status": get_val(["মিটার স্ট্যাটাস"]),
                "installation_date": get_val(["মিটার স্থাপনের তারিখ"]),
                "min_recharge_amount": get_val(["মিনিমাম রিচার্জের পরিমাণ (টাকা)", "মিনিমাম রিচার্জের পরিমাণ"])
            }

            # Step 3: POST to fetch monthly consumption
            consumption_data = {
                '_token': csrf_token,
                'cust_no': self.customer_number,
                'submit': self.SUBMIT_TYPE_MONTHLY_CONSUMPTION
            }
            consumption_response = session.post(self.BASE_URL, data=consumption_data, timeout=15)
            consumption_response.raise_for_status()
            consumption_html = consumption_response.text

            monthly_consumption = self._parse_consumption_table(consumption_html)

            # Determine current month consumption
            current_month_consumption = 0.0
            if monthly_consumption:
                try:
                    current_month_consumption = float(monthly_consumption[0].get('usage', 0.0))
                except ValueError:
                    pass

            due_notice = self._parse_due_notice(recharge_html)
            if not due_notice:
                due_notice = self._parse_due_notice(consumption_html)

            return {
                "balance": balance,
                "customer_name": customer_name,
                "meter_number": meter_number,
                "recharge_history": recharge_history,
                "monthly_consumption": monthly_consumption,
                "current_month_consumption": current_month_consumption,
                "last_reading_time": datetime.datetime.now(),
                "customer_info": customer_info,
                "due_notice": due_notice
            }

        except Exception as e:
            raise RuntimeError(f"NESCO fetch failed: {str(e)}")

    def _parse_due_notice(self, html):
        try:
            soup = BeautifulSoup(html, 'html.parser')
            # 1. Search for any elements containing "বকেয়া নোটিশ"
            for tag in soup.find_all(['div', 'table', 'td', 'p', 'span']):
                text = tag.get_text(separator="\n").strip()
                if "বকেয়া নোটিশ" in text and ("সম্মানিত গ্রাহক" in text or "বকেয়া বিল" in text):
                    lines = [line.strip() for line in text.split("\n") if line.strip()]
                    # Deduplicate preserving order
                    seen = set()
                    clean_lines = []
                    for l in lines:
                        if l not in seen:
                            seen.add(l)
                            clean_lines.append(l)
                    if len(clean_lines) >= 2:
                        return "\n".join(clean_lines)
                        
            # 2. Fallback: search for "সম্মানিত গ্রাহক" and "বকেয়া" in any container
            for tag in soup.find_all(['div', 'table', 'td']):
                text = tag.get_text(separator="\n").strip()
                if "সম্মানিত গ্রাহক" in text and ("বকেয়া বিল" in text or "বকেয়া নোটিশ" in text):
                    # Find the most specific nested container
                    has_child_match = False
                    for child in tag.find_all(['div', 'table', 'td']):
                        child_text = child.get_text().strip()
                        if "সম্মানিত গ্রাহক" in child_text and ("বকেয়া বিল" in child_text or "বকেয়া নোটিশ" in child_text):
                            has_child_match = True
                            break
                    if not has_child_match:
                        lines = [line.strip() for line in text.split("\n") if line.strip()]
                        seen = set()
                        clean_lines = []
                        for l in lines:
                            if l not in seen:
                                seen.add(l)
                                clean_lines.append(l)
                        return "\n".join(clean_lines)
        except Exception as e:
            print(f"Error parsing due notice: {e}")
        return None

    def _parse_inputs(self, html):
        soup = BeautifulSoup(html, 'html.parser')
        labels = soup.find_all('label')
        data = {}
        for label in labels:
            label_text = label.text.strip()
            label_text = re.sub(r'\s+', ' ', label_text)
            input_field = label.find_next('input')
            if input_field:
                value = input_field.get('value', '').strip()
                data[label_text] = value
        return data

    def _parse_recharge_table(self, html):
        soup = BeautifulSoup(html, 'html.parser')
        table = soup.find('table', class_='bfont_post')
        if not table:
            return []

        rows = []
        tbody = table.find('tbody')
        if not tbody:
            return []

        for tr in tbody.find_all('tr'):
            cols = [td.text.strip() for td in tr.find_all('td')]
            if len(cols) >= 15:
                # 15 Columns: S/N, Seq, Token, Rent, Demand, PFC, Vat, Arrears, Rebate, Energy, Amount, Power(kWh), Via, Date, Status
                rows.append({
                    "id": cols[0],
                    "token": cols[2],
                    "power": cols[11],
                    "amount": cols[10],
                    "via": cols[12],
                    "date": cols[13],
                    "status": cols[14]
                })
            elif len(cols) == 14:
                # 14 Columns fallback (if Seq No is missing)
                rows.append({
                    "id": cols[0],
                    "token": cols[1],
                    "power": cols[10],
                    "amount": cols[9],
                    "via": cols[11],
                    "date": cols[12],
                    "status": cols[13]
                })
        return rows

    def _parse_consumption_table(self, html):
        soup = BeautifulSoup(html, 'html.parser')
        table = soup.find('table', class_='bfont_post')
        if not table:
            return []

        rows = []
        tbody = table.find('tbody')
        if not tbody:
            return []

        for tr in tbody.find_all('tr'):
            cols = [td.text.strip() for td in tr.find_all('td')]
            if len(cols) >= 13:
                # Year, Month, Recharge, Discount, Usage (Index 12 is Used Electricity KWH!)
                rows.append({
                    "year": cols[0],
                    "month": cols[1],
                    "recharge": cols[2],
                    "discount": cols[3],
                    "usage": cols[12]
                })
            elif len(cols) >= 5:
                # Fallback if structure changes
                rows.append({
                    "year": cols[0],
                    "month": cols[1],
                    "recharge": cols[2],
                    "discount": cols[3],
                    "usage": cols[4]
                })
        return rows

    def _generate_demo_data(self):
        """Generates realistic demo data for testing."""
        customer_name = "মাহবুবুর রহমান হামিম"
        meter_number = "12345678901" if self.customer_number.upper() in ["TEST", "DEMO"] else self.customer_number

        is_deficit_test = "DEFICIT" in self.customer_number.upper()
        balance = -366.74 if is_deficit_test else 687.45

        # Recharge history (fake)
        recharge_history = [
            {
                "id": "1",
                "token": "0357 4370 2335 9968 9910",
                "power": "210.5",
                "amount": "1000",
                "via": "bKash",
                "date": (datetime.datetime.now() - datetime.timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S"),
                "status": "Success"
            },
            {
                "id": "2",
                "token": "4982 1209 7734 9122 3841",
                "power": "105.2",
                "amount": "500",
                "via": "Nagad",
                "date": (datetime.datetime.now() - datetime.timedelta(days=20)).strftime("%Y-%m-%d %H:%M:%S"),
                "status": "Success"
            }
        ]

        # Monthly consumption
        months = ["June", "May", "April", "March", "February"]
        monthly_consumption = []
        for i, m in enumerate(months):
            monthly_consumption.append({
                "year": "2026",
                "month": m,
                "recharge": "1000" if i % 2 == 0 else "500",
                "discount": "0.0",
                "usage": str(round(random.uniform(150.0, 250.0), 2))
            })

        current_month_consumption = float(monthly_consumption[0]["usage"])

        # Customer Info (fake)
        customer_info = {
            "customer_name": customer_name,
            "father_husband_name": "মোঃ আনোয়ার হোসেন",
            "address": "পূর্ব খাসবাগ, রংপুর",
            "mobile": "+880 171*****27",
            "electricity_office": "রংপুর S&D-3",
            "feeder_name": "কলেজ ফিডার রংপুর ৩",
            "consumer_number": "13005063" if self.customer_number.upper() in ["TEST", "DEMO"] else self.customer_number,
            "meter_number": "31011060216" if self.customer_number.upper() in ["TEST", "DEMO"] else self.customer_number,
            "approved_load": "3",
            "approved_tariff": "LT-A",
            "meter_type": "Single-Phase Meter",
            "meter_status": "Active",
            "installation_date": "16-Jan-2025 5:07 PM",
            "min_recharge_amount": "53.00"
        }

        # Mock due notice for Momena Jalil (13030301) or standard test
        due_notice = None
        if self.customer_number == "13030301" or self.customer_number.upper() in ["TEST", "DEMO"]:
            due_notice = (
                "বকেয়া নোটিশ\n\n"
                "সম্মানিত গ্রাহক,\n"
                "আপনার এই গ্রাহক নম্বরের বিপরীতে পূর্বের পোস্ট-পেইড মিটারের মোট বকেয়া বিল 8700.00 টাকা।\n"
                "অতিদ্রুত উক্ত বকেয়া বিলসমূহ পরিশোধ করুন; অন্যথায়, বিদ্যুৎ সংযোগ বিচ্ছিন্ন করা হবে অথবা উক্ত বকেয়া বিল প্রি-পেইড মিটারের সাথে সমন্বয় করা হবে। "
                "বকেয়া বিলসমূহ দেখতে ভিジット করুন postpaid.nesco.gov.bd ওয়েবসাইট।"
            )

        return {
            "balance": balance,
            "customer_name": customer_name,
            "meter_number": meter_number,
            "recharge_history": recharge_history,
            "monthly_consumption": monthly_consumption,
            "current_month_consumption": current_month_consumption,
            "last_reading_time": datetime.datetime.now(),
            "customer_info": customer_info,
            "due_notice": due_notice
        }

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
            
            # The last input is typically the balance input
            # If parsing fails or length is too short, raise error
            if not parsed_info:
                raise ValueError("Could not parse customer info or balance. Invalid customer number or page layout changed.")

            # Map the parsed info values
            info_values = list(parsed_info.values())
            
            # Extract customer name (usually index 1) and meter number (usually index 8)
            customer_name = info_values[1] if len(info_values) > 1 else "Unknown Customer"
            meter_number = info_values[8] if len(info_values) > 8 else self.customer_number
            balance_str = info_values[-1] if info_values else "0.0"

            try:
                balance = float(re.sub(r'[^\d.]', '', balance_str))
            except ValueError:
                balance = 0.0

            # Parse recharge history table
            recharge_history = self._parse_recharge_table(recharge_html)

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
                # The first row is usually the latest month
                try:
                    current_month_consumption = float(monthly_consumption[0].get('usage', 0.0))
                except ValueError:
                    pass

            return {
                "balance": balance,
                "customer_name": customer_name,
                "meter_number": meter_number,
                "recharge_history": recharge_history,
                "monthly_consumption": monthly_consumption,
                "current_month_consumption": current_month_consumption,
                "last_reading_time": datetime.datetime.now()
            }

        except Exception as e:
            raise RuntimeError(f"NESCO fetch failed: {str(e)}")

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
            if len(cols) >= 14:
                # ID, Token, Power, Amount, Via, Date, Status
                rows.append({
                    "id": cols[0],
                    "token": cols[1],
                    "power": cols[8],
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
            if len(cols) >= 5:
                # Year, Month, Recharge, Discount, Usage
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
        # Demo meter info
        customer_name = "মাহবুবুর রহমান হামিম"
        meter_number = "12345678901" if self.customer_number.upper() in ["TEST", "DEMO"] else self.customer_number

        # Random current balance between 100 and 1500
        balance = 687.45

        # Recharge history (fake)
        recharge_history = [
            {
                "id": "1",
                "token": "1002-3987-1234-9081-5463",
                "power": "210.5",
                "amount": "1000",
                "via": "bKash",
                "date": (datetime.datetime.now() - datetime.timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S"),
                "status": "Success"
            },
            {
                "id": "2",
                "token": "4982-1209-7734-9122-3841",
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

        return {
            "balance": balance,
            "customer_name": customer_name,
            "meter_number": meter_number,
            "recharge_history": recharge_history,
            "monthly_consumption": monthly_consumption,
            "current_month_consumption": current_month_consumption,
            "last_reading_time": datetime.datetime.now()
        }

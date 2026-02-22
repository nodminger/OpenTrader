# OpenTrader

OpenTrader is a powerful, early-stage open-source alternative to TradingView. It aims to provide a clean, smooth, and highly customizable trading interface with features like unlimited indicators and backtracking support.

[NOTE]
OpenTrader is currently in early stage. Suggestions and issue raising are highly welcome!

## 📸 Screenshots

![open trader trading view opensource alternative](https://raw.githubusercontent.com/nodminger/OpenTrader/refs/heads/master/Screenshots/screenshot1.png)
![open trader trading view opensource alternative](https://raw.githubusercontent.com/nodminger/OpenTrader/refs/heads/master/Screenshots/screenshot2.png)
![open trader trading view opensource alternative](https://raw.githubusercontent.com/nodminger/OpenTrader/refs/heads/master/Screenshots/screenshot3.png)
![open trader trading view opensource alternative](https://raw.githubusercontent.com/nodminger/OpenTrader/refs/heads/master/Screenshots/screenshot4.png)
![open trader trading view opensource alternative](https://raw.githubusercontent.com/nodminger/OpenTrader/refs/heads/master/Screenshots/screenshot5.png)
![open trader trading view opensource alternative](https://raw.githubusercontent.com/nodminger/OpenTrader/refs/heads/master/Screenshots/screenshot6.png)
![alt text](https://raw.githubusercontent.com/nodminger/OpenTrader/refs/heads/master/Screenshots/screenshot7.png)

## 🚀 Goals

- **Unlimited Indicators:** Break free from indicator limits and build complex charting setups.
- **Backtracking:** Equivalent features to TradingView's backtracking/backtesting capabilities.
- **Visual Excellence:** A modern, glassmorphic UI that feels premium and responsive.
- **Seamless Performance:** Built with modern technologies for a smooth charting experience.

## 🛠️ Tech Stack

### Backend
- **Framework:** [Django](https://www.djangoproject.com/) & [Django REST Framework](https://www.django-rest-framework.org/)
- **Data Source:** [Yfinance](https://github.com/ranar-w/yfinance) (Yahoo Finance API)
- **Data Processing:** [Pandas](https://pandas.pydata.org/)

### Frontend
- **Framework:** [React 19](https://react.dev/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Charting Library:** [Lightweight Charts](https://www.tradingview.com/lightweight-charts/) (by TradingView)
- **Communication:** Axios

## 📦 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm or yarn

### Backend Setup
1. Clone the repository and navigate to the root directory.
2. Create and activate a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run migrations:
   ```bash
   python manage.py migrate
   ```
5. Start the Django server:
   ```bash
   python manage.py runserver
   ```

### Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 🤝 Contributing

We welcome contributions of all kinds! If you have suggestions for new features or encounter any issues, please feel free to:
- Open an issue to report bugs or suggest enhancements.
- Submit a Pull Request with your improvements.

## ⚖️ License

Distributed under the GNU General Public License v3.0 (GPL-3.0). See `LICENSE` for more information.

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import yfinance as yf
import pandas as pd
from datetime import datetime

class TickerSearch(APIView):
    def get(self, request):
        query = request.query_params.get('q', '')
        if not query:
            return Response([])
        
        try:
            # yfinance doesn't have a direct "search" in the same way as the website
            # but we can use the Ticker and info, or the newer Search functionality
            search = yf.Search(query, max_results=10)
            results = []
            for quote in search.quotes:
                results.append({
                    'symbol': quote.get('symbol'),
                    'name': quote.get('shortname') or quote.get('longname'),
                    'type': quote.get('quoteType'),
                    'exchange': quote.get('exchange')
                })
            return Response(results)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class TickerHistory(APIView):
    def get(self, request):
        symbol = request.query_params.get('symbol')
        interval = request.query_params.get('interval', '1d')
        period = request.query_params.get('range', '1mo')
        start = request.query_params.get('start')
        end = request.query_params.get('end')
        
        if not symbol:
            return Response({'error': 'Symbol is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            ticker = yf.Ticker(symbol)
            
            if start and end:
                # Convert unix timestamps to datetime
                start_dt = datetime.fromtimestamp(int(start))
                end_dt = datetime.fromtimestamp(int(end))
                df = ticker.history(start=start_dt, end=end_dt, interval=interval)
            else:
                df = ticker.history(period=period, interval=interval)
            
            if df.empty:
                return Response({'error': 'No data found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Reset index to get Date/Datetime as a column
            df = df.reset_index()
            
            # Rename columns to match lightweight-charts expectations
            # lightweight-charts uses Unix timestamps (seconds) or YYYY-MM-DD
            data = []
            for _, row in df.iterrows():
                # Handle both Date (DatetimeIndex) and Datetime (DatetimeIndex with time)
                if 'Date' in row:
                    time = row['Date']
                elif 'Datetime' in row:
                    time = row['Datetime']
                else:
                    time = df.iloc[_]['index'] if 'index' in df.columns else None
                
                if time is None: continue
                
                # Convert to unix timestamp (seconds)
                timestamp = int(time.timestamp())
                
                data.append({
                    'time': timestamp,
                    'open': row['Open'],
                    'high': row['High'],
                    'low': row['Low'],
                    'close': row['Close'],
                    'volume': row['Volume']
                })
            
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

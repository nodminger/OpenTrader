from django.urls import path
from .views import TickerSearch, TickerHistory

urlpatterns = [
    path('search/', TickerSearch.as_view(), name='ticker-search'),
    path('history/', TickerHistory.as_view(), name='ticker-history'),
]

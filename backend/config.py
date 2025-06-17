import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev_secret')
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'mysql+pymysql://root@localhost:3306/pgt'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
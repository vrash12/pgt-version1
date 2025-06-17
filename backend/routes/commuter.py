from flask import Blueprint, request, jsonify
# import your models, helper functions, etc.

commuter_bp = Blueprint('commuter', __name__)

@commuter_bp.route('/location', methods=['GET'])
def vehicle_location():
    # return real-time vehicle location & capacity
    ...

@commuter_bp.route('/timetable', methods=['GET'])
def timetable():
    # return route timetable
    ...

@commuter_bp.route('/share-location', methods=['POST'])
def share_location():
    # commuter shares own GPS
    ...

@commuter_bp.route('/eta', methods=['GET'])
def eta():
    # calculate & return ETA
    ...

@commuter_bp.route('/announcements', methods=['GET'])
def announcements():
    # list active announcements
    ...

@commuter_bp.route('/receipts', methods=['GET'])
def fare_receipts():
    # list past fare receipts
    ...

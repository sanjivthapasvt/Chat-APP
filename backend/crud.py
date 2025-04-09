from sqlalchemy.orm import Session

import models, database

def create_room(db: Session, room: models.Room):
    db_room = database.RoomDB(name=room.name)
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room

def create_user(db: Session, user: models.User):
    db_user = database.UserBD(username=user.username)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_room(db: Session, room_id: str):
    return db.query(database.RoomDB).filter(database.RoomDB.name == room_id).first()


def get_user(db: Session, user_id: str):
    return db.query(database.UserBD).filter(database.UserBD.username == user_id).first()
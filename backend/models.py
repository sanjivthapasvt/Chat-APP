from pydantic import BaseModel

class Room(BaseModel):
    name: str
    
class User(BaseModel):
    username: str
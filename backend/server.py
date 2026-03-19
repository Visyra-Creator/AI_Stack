from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from bson import ObjectId


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class ItemBase(BaseModel):
    category: str
    title: str
    description: str = ""
    notes: Optional[str] = None
    image: Optional[str] = None
    url: Optional[str] = None

class ItemCreate(ItemBase):
    pass

class ItemUpdate(ItemBase):
    pass

class Item(ItemBase):
    id: str
    createdAt: datetime
    updatedAt: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# Helper function to serialize MongoDB document
def item_helper(item) -> dict:
    return {
        "id": str(item["_id"]),
        "category": item["category"],
        "title": item["title"],
        "description": item.get("description", ""),
        "notes": item.get("notes"),
        "image": item.get("image"),
        "url": item.get("url"),
        "createdAt": item.get("createdAt"),
        "updatedAt": item.get("updatedAt")
    }


# Routes
@api_router.get("/")
async def root():
    return {"message": "AI Stack Keeper API"}


@api_router.get("/items", response_model=List[Item])
async def get_items(category: Optional[str] = None):
    """Get all items, optionally filtered by category"""
    try:
        query = {"category": category} if category else {}
        items = await db.items.find(query).sort("updatedAt", -1).to_list(1000)
        return [item_helper(item) for item in items]
    except Exception as e:
        logger.error(f"Error getting items: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/items/{item_id}", response_model=Item)
async def get_item(item_id: str):
    """Get a single item by ID"""
    try:
        if not ObjectId.is_valid(item_id):
            raise HTTPException(status_code=400, detail="Invalid item ID")
        
        item = await db.items.find_one({"_id": ObjectId(item_id)})
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        return item_helper(item)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting item: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/items", response_model=Item)
async def create_item(item: ItemCreate):
    """Create a new item"""
    try:
        now = datetime.utcnow()
        item_dict = item.dict()
        item_dict["createdAt"] = now
        item_dict["updatedAt"] = now
        
        result = await db.items.insert_one(item_dict)
        created_item = await db.items.find_one({"_id": result.inserted_id})
        
        return item_helper(created_item)
    except Exception as e:
        logger.error(f"Error creating item: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/items/{item_id}", response_model=Item)
async def update_item(item_id: str, item: ItemUpdate):
    """Update an existing item"""
    try:
        if not ObjectId.is_valid(item_id):
            raise HTTPException(status_code=400, detail="Invalid item ID")
        
        existing_item = await db.items.find_one({"_id": ObjectId(item_id)})
        if not existing_item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        item_dict = item.dict()
        item_dict["updatedAt"] = datetime.utcnow()
        
        await db.items.update_one(
            {"_id": ObjectId(item_id)},
            {"$set": item_dict}
        )
        
        updated_item = await db.items.find_one({"_id": ObjectId(item_id)})
        return item_helper(updated_item)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating item: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/items/{item_id}")
async def delete_item(item_id: str):
    """Delete an item"""
    try:
        if not ObjectId.is_valid(item_id):
            raise HTTPException(status_code=400, detail="Invalid item ID")
        
        result = await db.items.delete_one({"_id": ObjectId(item_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        
        return {"message": "Item deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting item: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

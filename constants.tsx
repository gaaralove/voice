
import React from 'react';

export const DEFAULT_MODEL = 'gemini-3-flash-preview';
export const DEFAULT_SYSTEM_INSTRUCTION = `You are a professional food ordering assistant. 
1. Analyze user screenshots to extract order history (Restaurant name, Items, Price). 
2. Learn user preferences (spicy, vegetarian, etc.).
3. When the user gives a command, suggest the best meal based on history and location. 
4. Be concise and helpful.`;

export const MOCK_ADDRESSES = [
  "No. 123 Tech Park Road, Haidian District, Beijing",
  "Room 404, Building 2, Moonlight Garden, Shanghai"
];

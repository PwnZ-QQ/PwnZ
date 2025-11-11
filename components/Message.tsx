
import React from 'react';
import type { AiChatMessage } from '../types';

interface MessageProps {
  message: AiChatMessage;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs md:max-w-md p-3 rounded-2xl ${isUser ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-white'}`}>
        <p className="whitespace-pre-wrap text-sm">{message.text}</p>
      </div>
    </div>
  );
};

export default Message;

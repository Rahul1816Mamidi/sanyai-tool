
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create chats table
create table chats (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default now()
);

-- Create messages table
create table messages (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid references chats(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamp with time zone default now()
);

-- Create index for faster queries
create index idx_messages_chat_id on messages(chat_id);

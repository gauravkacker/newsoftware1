// ============================================
// Module 2: Staff Messaging Page
// Internal communication system (Module 2.11)
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { staffMessageDb, userDb } from '@/lib/db/database';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { StaffMessage, User } from '@/types';

export default function MessagesPage() {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [messageContent, setMessageContent] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent' | 'critical'>('normal');

  useEffect(() => {
    if (user) {
      const loadMessages = () => {
        const userMessages = staffMessageDb.getByUser(user.id) as StaffMessage[];
        const sortedMessages = userMessages.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setMessages(sortedMessages);
      };
      loadMessages();
    }
  }, [user]);

  const users = (userDb.getAll() as User[]).filter((u: User) => u.id !== user?.id);
  const unreadCount = messages.filter((m) => !m.readAt).length;

  const handleSend = () => {
    if (!user || !selectedRecipient || !messageContent) return;

    const recipient = users.find((u) => u.id === selectedRecipient);
    if (!recipient) return;

    staffMessageDb.create({
      senderId: user.id,
      senderName: user.name,
      recipientId: selectedRecipient,
      recipientName: recipient.name,
      content: messageContent,
      priority,
      createdAt: new Date(),
    });

    // Reset form
    setMessageContent('');
    setSelectedRecipient('');
    setPriority('normal');
    setShowCompose(false);

    // Refresh messages
    const updatedMessages = staffMessageDb.getByUser(user.id) as StaffMessage[];
    setMessages(updatedMessages.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
  };

  const handleMarkRead = (messageId: string) => {
    staffMessageDb.markRead(messageId);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, readAt: new Date() } : m
      )
    );
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">Please log in to view messages</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Staff Messages</h1>
        <div className="space-x-2">
          <Badge variant="outline">{unreadCount} unread</Badge>
          <Button onClick={() => setShowCompose(true)}>
            Compose
          </Button>
        </div>
      </div>

      {showCompose && (
        <Card>
          <CardHeader>
            <CardTitle>New Message</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To
                </label>
                <select
                  value={selectedRecipient}
                  onChange={(e) => setSelectedRecipient(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Select recipient...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as typeof priority)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={4}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Type your message..."
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="secondary" onClick={() => setShowCompose(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSend} disabled={!selectedRecipient || !messageContent}>
                  Send
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages List */}
      <div className="space-y-4">
        {messages.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500">No messages yet</p>
            </CardContent>
          </Card>
        ) : (
          messages.map((message) => (
            <Card
              key={message.id}
              className={!message.readAt ? 'border-blue-200 bg-blue-50' : ''}
            >
              <CardContent className="py-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">{message.senderName}</span>
                      {message.priority !== 'normal' && (
                        <Badge
                          variant={message.priority === 'critical' ? 'destructive' : 'warning'}
                        >
                          {message.priority}
                        </Badge>
                      )}
                      {!message.readAt && (
                        <Badge variant="info">New</Badge>
                      )}
                      <span className="text-sm text-gray-500">
                        {new Date(message.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-700">{message.content}</p>
                  </div>
                  {!message.readAt && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleMarkRead(message.id)}
                    >
                      Mark Read
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

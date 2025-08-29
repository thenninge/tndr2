"use client";
import { useState, useEffect } from 'react';
import { ELGPOSTER } from './elgposter';

interface MaintenanceTask {
  id: string;
  postId: number;
  description: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | 'completed';
  createdAt: Date;
  completedAt?: Date;
  assignedTo?: string;
}

interface Elgpost {
  nr: number;
  lat: number;
  lng: number;
  name: string;
  omrade: string;
}

export default function VedlikeholdTab() {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [selectedPost, setSelectedPost] = useState<Elgpost | null>(null);
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskTags, setNewTaskTags] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [filterOmrade, setFilterOmrade] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Load tasks from localStorage on mount
  useEffect(() => {
    const savedTasks = localStorage.getItem('maintenanceTasks');
    if (savedTasks) {
      const parsedTasks = JSON.parse(savedTasks).map((task: any) => ({
        ...task,
        createdAt: new Date(task.createdAt),
        completedAt: task.completedAt ? new Date(task.completedAt) : undefined
      }));
      setTasks(parsedTasks);
    }
  }, []);

  // Save tasks to localStorage whenever tasks change
  useEffect(() => {
    localStorage.setItem('maintenanceTasks', JSON.stringify(tasks));
  }, [tasks]);

  const addTask = () => {
    if (!selectedPost || !newTaskDescription.trim()) return;

    const newTask: MaintenanceTask = {
      id: Date.now().toString(),
      postId: selectedPost.nr,
      description: newTaskDescription.trim(),
      tags: newTaskTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
      priority: newTaskPriority,
      status: 'pending',
      createdAt: new Date()
    };

    setTasks(prev => [...prev, newTask]);
    setNewTaskDescription('');
    setNewTaskTags('');
    setNewTaskPriority('medium');
  };

  const updateTaskStatus = (taskId: string, status: MaintenanceTask['status']) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { 
            ...task, 
            status, 
            completedAt: status === 'completed' ? new Date() : undefined 
          }
        : task
    ));
  };

  const deleteTask = (taskId: string) => {
    if (window.confirm('Er du sikker på at du vil slette denne oppgaven?')) {
      setTasks(prev => prev.filter(task => task.id !== taskId));
    }
  };

  const getTasksForPost = (postId: number) => {
    return tasks.filter(task => task.postId === postId);
  };

  const getFilteredTasks = () => {
    let filtered = tasks;

    if (filterOmrade !== 'all') {
      filtered = filtered.filter(task => {
        const post = ELGPOSTER.find(p => p.nr === task.postId);
        return post?.omrade === filterOmrade;
      });
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(task => task.status === filterStatus);
    }

    if (filterPriority !== 'all') {
      filtered = filtered.filter(task => task.priority === filterPriority);
    }

    if (searchTerm) {
      filtered = filtered.filter(task => 
        task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
        ELGPOSTER.find(p => p.nr === task.postId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const getOmradeOptions = () => {
    const omrader = [...new Set(ELGPOSTER.map(post => post.omrade))];
    return omrader.sort();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#ca8a04';
      case 'low': return '#16a34a';
      default: return '#6b7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#16a34a';
      case 'in-progress': return '#ca8a04';
      case 'pending': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const filteredTasks = getFilteredTasks();
  const omradeOptions = getOmradeOptions();

  return (
    <div style={{ padding: '20px 0' }}>
      <h2 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: '600' }}>
        Vedlikehold - Elgposter
      </h2>

      {/* Filters */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px', 
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px'
      }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Område:</label>
          <select 
            value={filterOmrade} 
            onChange={(e) => setFilterOmrade(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          >
            <option value="all">Alle områder</option>
            {omradeOptions.map(omrade => (
              <option key={omrade} value={omrade}>{omrade}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Status:</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          >
            <option value="all">Alle statuser</option>
            <option value="pending">Venter</option>
            <option value="in-progress">Under arbeid</option>
            <option value="completed">Fullført</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Prioritet:</label>
          <select 
            value={filterPriority} 
            onChange={(e) => setFilterPriority(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          >
            <option value="all">Alle prioriter</option>
            <option value="urgent">Kritisk</option>
            <option value="high">Høy</option>
            <option value="medium">Medium</option>
            <option value="low">Lav</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Søk:</label>
          <input
            type="text"
            placeholder="Søk i beskrivelse, tags eller postnavn..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          />
        </div>
      </div>

      {/* Add new task section */}
      <div style={{ 
        marginBottom: '24px', 
        padding: '20px', 
        backgroundColor: '#f0f9ff', 
        borderRadius: '8px',
        border: '1px solid #0ea5e9'
      }}>
        <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>Legg til ny vedlikeholdsoppgave</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Velg elgpost:</label>
            <select 
              value={selectedPost?.nr || ''} 
              onChange={(e) => {
                const post = ELGPOSTER.find(p => p.nr === parseInt(e.target.value));
                setSelectedPost(post || null);
              }}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
            >
              <option value="">Velg elgpost...</option>
              {ELGPOSTER.map(post => (
                <option key={post.nr} value={post.nr}>
                  {post.nr} - {post.name} ({post.omrade})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Prioritet:</label>
            <select 
              value={newTaskPriority} 
              onChange={(e) => setNewTaskPriority(e.target.value as any)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
            >
              <option value="low">Lav</option>
              <option value="medium">Medium</option>
              <option value="high">Høy</option>
              <option value="urgent">Kritisk</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Beskrivelse:</label>
          <textarea
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            placeholder="Beskriv hva som må gjøres..."
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #d1d5db',
              minHeight: '80px',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Tags (kommaseparert):</label>
          <input
            type="text"
            value={newTaskTags}
            onChange={(e) => setNewTaskTags(e.target.value)}
            placeholder="f.eks. rep, tak, dør, elektrisk"
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          />
        </div>

        <button
          onClick={addTask}
          disabled={!selectedPost || !newTaskDescription.trim()}
          style={{
            padding: '10px 20px',
            backgroundColor: selectedPost && newTaskDescription.trim() ? '#0ea5e9' : '#9ca3af',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: selectedPost && newTaskDescription.trim() ? 'pointer' : 'not-allowed',
            fontWeight: '500'
          }}
        >
          Legg til oppgave
        </button>
      </div>

      {/* Tasks overview */}
      <div>
        <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
          Vedlikeholdsoppgaver ({filteredTasks.length})
        </h3>

        {filteredTasks.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            backgroundColor: '#f8fafc', 
            borderRadius: '8px',
            color: '#6b7280'
          }}>
            Ingen oppgaver funnet med valgte filtre
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {filteredTasks.map(task => {
              const post = ELGPOSTER.find(p => p.nr === task.postId);
              return (
                <div key={task.id} style={{
                  padding: '16px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>
                        {post?.name} (Post {task.postId})
                      </h4>
                      <p style={{ margin: '0 0 8px 0', color: '#6b7280', fontSize: '14px' }}>
                        {post?.omrade} • {task.createdAt.toLocaleDateString('nb-NO')}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: getPriorityColor(task.priority) + '20',
                        color: getPriorityColor(task.priority)
                      }}>
                        {task.priority === 'urgent' ? 'Kritisk' : 
                         task.priority === 'high' ? 'Høy' : 
                         task.priority === 'medium' ? 'Medium' : 'Lav'}
                      </span>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: getStatusColor(task.status) + '20',
                        color: getStatusColor(task.status)
                      }}>
                        {task.status === 'pending' ? 'Venter' : 
                         task.status === 'in-progress' ? 'Under arbeid' : 'Fullført'}
                      </span>
                    </div>
                  </div>

                  <p style={{ margin: '0 0 12px 0', lineHeight: '1.5' }}>
                    {task.description}
                  </p>

                  {task.tags.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      {task.tags.map(tag => (
                        <span key={tag} style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          margin: '0 4px 4px 0',
                          backgroundColor: '#e0e7ff',
                          color: '#3730a3',
                          borderRadius: '12px',
                          fontSize: '12px'
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      value={task.status}
                      onChange={(e) => updateTaskStatus(task.id, e.target.value as MaintenanceTask['status'])}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '14px' }}
                    >
                      <option value="pending">Venter</option>
                      <option value="in-progress">Under arbeid</option>
                      <option value="completed">Fullført</option>
                    </select>

                    <button
                      onClick={() => deleteTask(task.id)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Slett
                    </button>
                  </div>

                  {task.completedAt && (
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#16a34a' }}>
                      Fullført: {task.completedAt.toLocaleDateString('nb-NO')} {task.completedAt.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

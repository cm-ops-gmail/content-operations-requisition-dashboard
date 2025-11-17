
'use client'

import React, { useState, useEffect, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getKanbanTasks, getMembers, addKanbanTask, updateKanbanTask, updateKanbanTaskStatus, deleteKanbanTask, batchUpdateKanbanTaskSequence } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Search, Users, Calendar, Trash2, Edit } from 'lucide-react';
import type { KanbanTask } from '@/lib/mock-data';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

type ColumnId = 'todo' | 'inprogress' | 'review' | 'done';

const columnsConfig: Record<ColumnId, { title: string; color: string }> = {
  todo: { title: 'To Do', color: 'bg-secondary border-border' },
  inprogress: { title: 'In Progress', color: 'bg-primary/10 border-primary/20' },
  review: { title: 'Review', color: 'bg-accent/20 border-accent/30' },
  done: { title: 'Done', color: 'bg-green-500/10 border-green-500/20' },
};

export default function KanbanPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Record<ColumnId, KanbanTask[]>>({ todo: [], inprogress: [], review: [], done: [] });
  const [members, setMembers] = useState<string[][]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    type: 'Promotional',
    priority: 'Medium' as KanbanTask['priority'],
    assignee: '',
    dueDate: '',
    tags: [] as string[]
  });

  const { toast } = useToast();
  
  const getPriorityColor = (priority: KanbanTask['priority']) => {
    switch (priority) {
      case "Critical": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "High": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "Medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "Low": return "bg-green-500/10 text-green-500 border-green-500/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const fetchData = async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const [taskData, memberData] = await Promise.all([getKanbanTasks(projectId), getMembers()]);

      const categorizedTasks: Record<ColumnId, KanbanTask[]> = { todo: [], inprogress: [], review: [], done: [] };
      taskData.sort((a, b) => a.sequenceNumber - b.sequenceNumber).forEach(task => {
        const status = task.status as ColumnId;
        if (categorizedTasks[status]) {
          categorizedTasks[status].push(task);
        } else {
            categorizedTasks.todo.push(task); // Default to 'todo' if status is invalid
        }
      });
      setTasks(categorizedTasks);

      if (memberData && memberData.values && memberData.values.length > 0) {
        const memberRows = memberData.values.slice(1);
        setMembers(memberRows);
        const uniqueTeams = [...new Set(memberRows.map(m => m[1]).filter(Boolean))];
        setTeams(uniqueTeams);
      }

    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load Kanban board data.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    const startColId = source.droppableId as ColumnId;
    const endColId = destination.droppableId as ColumnId;
    
    // Create a deep copy of tasks to manipulate
    const newTasksState = JSON.parse(JSON.stringify(tasks));
    
    // Find and remove task from source column
    const sourceCol = newTasksState[startColId] as KanbanTask[];
    const taskIndex = sourceCol.findIndex(t => t.id === draggableId);
    if (taskIndex === -1) return;
    const [movedTask] = sourceCol.splice(taskIndex, 1);

    if (startColId === endColId) {
        // Move within the same column
        sourceCol.splice(destination.index, 0, movedTask);
        
        // Update sequence numbers for the entire column
        const sequenceUpdates = sourceCol.map((task, index) => ({
            sheetRowIndex: task.sheetRowIndex,
            sequenceNumber: index + 1,
        }));
        
        // Optimistic UI update
        newTasksState[startColId] = sourceCol.map((task, index) => ({ ...task, sequenceNumber: index + 1 }));
        setTasks(newTasksState);

        const res = await batchUpdateKanbanTaskSequence(sequenceUpdates);
        if (!res.success) {
            toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update task sequence.' });
            fetchData(); // Revert on failure
        }
    } else {
        // Move to a different column
        const destCol = newTasksState[endColId] as KanbanTask[];
        destCol.splice(destination.index, 0, movedTask);
        movedTask.status = endColId;

        // Update sequence numbers for both columns
        const sourceColUpdates = sourceCol.map((task, index) => ({
            sheetRowIndex: task.sheetRowIndex,
            sequenceNumber: index + 1,
        }));
        const destColUpdates = destCol.map((task, index) => ({
            sheetRowIndex: task.sheetRowIndex,
            sequenceNumber: index + 1,
        }));

        // Optimistic UI Update
        newTasksState[startColId] = sourceCol.map((t, i) => ({ ...t, sequenceNumber: i + 1 }));
        newTasksState[endColId] = destCol.map((t, i) => ({ ...t, sequenceNumber: i + 1 }));
        setTasks(newTasksState);
        
        // Batch update all changes
        const statusUpdateResult = await updateKanbanTaskStatus(movedTask.sheetRowIndex, endColId);
        const sequenceUpdateResult = await batchUpdateKanbanTaskSequence([...sourceColUpdates, ...destColUpdates]);

        if (!statusUpdateResult.success || !sequenceUpdateResult.success) {
            toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update task.' });
            fetchData(); // Revert on failure
        }
    }
};

  
  const handleOpenDialog = (task: KanbanTask | null = null) => {
    setEditingTask(task);
    if (task) {
        setTaskForm({
            title: task.title,
            description: task.description || '',
            type: task.type,
            priority: task.priority,
            assignee: task.assignee,
            dueDate: task.dueDate || '',
            tags: task.tags
        });
    } else {
        setTaskForm({
            title: '', description: '', type: 'Promotional', priority: 'Medium', assignee: '', dueDate: '', tags: []
        });
    }
    setIsDialogOpen(true);
  }

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) {
        toast({ variant: 'destructive', title: 'Error', description: 'Task title is required.' });
        return;
    }
    setIsSubmitting(true);
    
    let result;
    if (editingTask) {
        result = await updateKanbanTask(editingTask.sheetRowIndex, {
            ...taskForm,
        });
    } else {
        result = await addKanbanTask(projectId, {
            ...taskForm,
        });
    }
    
    if (result.success) {
      toast({ title: `Task ${editingTask ? 'Updated' : 'Added'}!`, description: `"${taskForm.title}" has been saved.` });
      setIsDialogOpen(false);
      await fetchData();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to save task.' });
    }
    setIsSubmitting(false);
  };
  
  const handleDelete = async (task: KanbanTask) => {
    if (!confirm(`Are you sure you want to delete the task: "${task.title}"?`)) return;

    const columnId = task.status as ColumnId;
    setTasks(prev => ({
        ...prev,
        [columnId]: prev[columnId].filter(t => t.id !== task.id)
    }));

    const result = await deleteKanbanTask(task.sheetRowIndex);
    if (!result.success) {
        toast({ variant: 'destructive', title: 'Delete Failed', description: 'Could not delete task.' });
        await fetchData(); 
    } else {
         toast({ title: 'Task Deleted', description: `"${task.title}" has been deleted.` });
    }
  }
  
  const filteredColumns = (Object.keys(columnsConfig) as ColumnId[]).map(columnId => {
    const columnTasks = tasks[columnId] || [];
    const filteredTickets = columnTasks.filter(ticket => {
        const member = members.find(m => m[0] === ticket.assignee);
        const team = member ? member[1] : '';

        const matchesTeam = selectedTeam === 'all' || team === selectedTeam;
        const matchesPriority = selectedPriority === 'all' || ticket.priority === selectedPriority;
        const matchesSearch =
            searchQuery === '' ||
            ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (ticket.description && ticket.description.toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesTeam && matchesPriority && matchesSearch;
    });
    return {
        ...columnsConfig[columnId],
        id: columnId,
        tickets: filteredTickets
    }
  });

  const totalTickets = Object.values(tasks).flat().length;
  const canManage = user?.role === 'admin' || user?.role === 'sub-admin';

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Kanban: {projectId}</h1>
      </div>
      
       <div className="border-b border-border bg-card mb-6">
        <div className="px-6 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team} value={team}>
                    {team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {totalTickets} tasks
            </Badge>
            {canManage && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" /> Add Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingTask ? 'Edit Task' : 'Add New Task'}</DialogTitle></DialogHeader>
                <form onSubmit={handleFormSubmit}>
                  <div className="space-y-4 py-4">
                    <div><Label>Task Title</Label><Input value={taskForm.title} onChange={(e) => setTaskForm(p => ({ ...p, title: e.target.value }))} placeholder="Enter task title" /></div>
                    <div><Label>Description</Label><Textarea value={taskForm.description} onChange={(e) => setTaskForm(p => ({ ...p, description: e.target.value }))} placeholder="Enter task description" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Type</Label><Select value={taskForm.type} onValueChange={(v) => setTaskForm(p => ({ ...p, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Promotional">Promotional</SelectItem><SelectItem value="Paid">Paid</SelectItem><SelectItem value="Recorded">Recorded</SelectItem></SelectContent></Select></div>
                      <div><Label>Priority</Label><Select value={taskForm.priority} onValueChange={(v) => setTaskForm(p => ({ ...p, priority: v as KanbanTask['priority'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Low">Low</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="High">High</SelectItem><SelectItem value="Critical">Critical</SelectItem></SelectContent></Select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div><Label>Assign To</Label><Select value={taskForm.assignee} onValueChange={(v) => setTaskForm(p => ({ ...p, assignee: v }))}><SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger><SelectContent>{members.map((m) => (<SelectItem key={`${m[0]}-${m[1]}`} value={m[0]}>{m[0]} ({m[1]})</SelectItem>))}</SelectContent></Select></div>
                        <div>
                          <Label>Due Date</Label>
                           <Popover>
                              <PopoverTrigger asChild>
                                  <Button
                                      variant={"outline"}
                                      className={cn(
                                          "w-full justify-start text-left font-normal",
                                          !taskForm.dueDate && "text-muted-foreground"
                                      )}
                                  >
                                      <Calendar className="mr-2 h-4 w-4" />
                                      {taskForm.dueDate ? format(parseISO(taskForm.dueDate), "PPP") : <span>Pick a date</span>}
                                  </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                  <CalendarComponent
                                      mode="single"
                                      selected={taskForm.dueDate ? new Date(taskForm.dueDate) : undefined}
                                      onSelect={(date) => setTaskForm(p => ({...p, dueDate: date ? date.toISOString() : ''}))}
                                      initialFocus
                                  />
                              </PopoverContent>
                          </Popover>
                       </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingTask ? 'Save Changes' : 'Add Task'}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-16"><Loader2 className="mr-2 h-12 w-12 animate-spin text-primary" /> <span className="text-muted-foreground">Loading tasks...</span></div>
      ) : (
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {filteredColumns.map(column => (
            <div key={column.id} className="flex flex-col">
              <div className={`rounded-t-lg border-2 ${column.color} p-4`}>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-foreground">{column.title}</h2>
                  <Badge variant="secondary" className="text-xs">{column.tickets.length}</Badge>
                </div>
              </div>
              <Droppable droppableId={column.id} isDropDisabled={!canManage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 border-l-2 border-r-2 border-b-2 ${column.color.replace('bg-', 'border-').split(" ")[1]} rounded-b-lg p-4 space-y-4 min-h-96 transition-colors ${snapshot.isDraggingOver ? 'bg-muted' : ''}`}
                  >
                    {column.tickets.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={!canManage}>
                        {(provided) => (
                           <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="hover:shadow-md transition-shadow bg-card cursor-move relative group"
                          >
                           <CardHeader className="pb-3 pr-12">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="absolute top-2 left-2 h-6 w-6 flex items-center justify-center bg-muted-foreground/10 text-muted-foreground rounded-full text-xs font-bold">
                                    {task.sequenceNumber || index + 1}
                                </div>
                                <div className="flex items-center gap-2 mb-2 pl-8">
                                    <Badge variant="outline" className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                                </div>
                                <CardTitle className="text-sm font-medium leading-tight pl-8">{task.title}</CardTitle>
                              </div>
                              {canManage && (
                                <div className="absolute top-2 right-2 flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleOpenDialog(task)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(task)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                              )}
                            </div>
                           </CardHeader>
                           <CardContent className="pt-0">
                               <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
                               <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2">
                                     <Avatar className="h-6 w-6"><AvatarFallback className="text-xs bg-secondary text-secondary-foreground">{task.assignee ? task.assignee.charAt(0) : '?'}</AvatarFallback></Avatar>
                                     <span className="text-xs text-muted-foreground">{task.assignee || 'Unassigned'}</span>
                                 </div>
                                 {task.dueDate && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />{format(parseISO(task.dueDate), 'MMM dd')}</div>}
                               </div>
                           </CardContent>
                         </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
      )}
    </div>
  );
}

    

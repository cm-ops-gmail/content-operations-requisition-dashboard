
'use client'

import { useState, useEffect } from 'react';
import { TicketForm } from '@/components/TicketForm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { getWorkTypes } from '@/app/actions';
import { Checkbox } from '@/components/ui/checkbox';

const PREDEFINED_TEAMS = ["CM", "QAC", "SMD", "Class Ops"];

export default function NewTicketPage() {
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [workTypeInfo, setWorkTypeInfo] = useState<{ question: string; options: string[] }>({ question: '', options: [] });
  const [selectedWorkType, setSelectedWorkType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFormReady, setIsFormReady] = useState(false);

  useEffect(() => {
    async function fetchInitialData() {
        setIsLoading(true);
        try {
            const types = await getWorkTypes();
            setWorkTypeInfo(types);
        } catch (error) {
            console.error("Failed to fetch initial data", error);
        } finally {
            setIsLoading(false);
        }
    }
    fetchInitialData();
  }, []);

  const updateFormVisibility = () => {
      // This will be called after state updates
      if (selectedTeams.length > 0 && selectedWorkType) {
        setIsFormReady(true);
      } else {
        setIsFormReady(false);
      }
  };

  // We use a separate effect to handle visibility to avoid race conditions with state updates
  useEffect(() => {
      if (!isLoading) {
        updateFormVisibility();
      }
  }, [selectedTeams, selectedWorkType, isLoading]);


  const handleTeamChange = (team: string, checked: boolean) => {
      setSelectedTeams(prev => {
          const newTeams = checked ? [...prev, team] : prev.filter(t => t !== team);
          return newTeams;
      });
  };

  const handleWorkTypeChange = (workType: string) => {
      setSelectedWorkType(workType);
  }

  const getCardClasses = () => {
    if (selectedWorkType === 'Urgent') {
        return 'border-red-500/50';
    }
    if (selectedWorkType === 'Regular') {
        return 'border-green-500/50';
    }
    return '';
  }

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4 md:px-6">
      <div className="space-y-2 text-center mb-8">
        <h1 className="text-3xl font-bold">Create a New Ticket</h1>
        <p className="text-muted-foreground">Fill out the form below to submit a new ticket.</p>
      </div>

      <Card className={`mb-6 transition-all ${getCardClasses()}`}>
        <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
             <Label htmlFor="work-type-select">{workTypeInfo.question || 'Work Type'}</Label>
             {isLoading ? (
                <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading work types...
                </div>
             ) : (
                <Select value={selectedWorkType} onValueChange={handleWorkTypeChange}>
                    <SelectTrigger id="work-type-select" className="w-full">
                        <SelectValue placeholder="Select the type of work" />
                    </SelectTrigger>
                    <SelectContent>
                        {workTypeInfo.options.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
             )}
          </div>
            <div className="space-y-3">
             <Label>The requisition is for which team? *</Label>
             <div className="grid grid-cols-2 gap-4">
                {PREDEFINED_TEAMS.map(team => (
                    <div key={team} className="flex items-center space-x-2">
                        <Checkbox
                            id={`team-${team}`}
                            onCheckedChange={(checked) => handleTeamChange(team, Boolean(checked))}
                            checked={selectedTeams.includes(team)}
                        />
                        <label
                            htmlFor={`team-${team}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            {team}
                        </label>
                    </div>
                ))}
             </div>
          </div>
        </CardContent>
      </Card>
      
      {isFormReady ? (
        <TicketForm key={selectedTeams.join('-')} teams={selectedTeams} workType={selectedWorkType} />
      ) : (
        <div className="text-center text-muted-foreground p-8">
            <p>Please select a work type and at least one team to see the form.</p>
        </div>
      )}
    </div>
  );
}

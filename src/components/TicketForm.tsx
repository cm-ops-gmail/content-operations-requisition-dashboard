
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm, type UseFormReturn, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { submitTicket, getFormQuestions } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon } from 'lucide-react';
import type { FormQuestion } from '@/lib/mock-data';
import { Checkbox } from './ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// Component to render the correct form field based on question type
const FormFieldBuilder = ({ question, form }: { question: FormQuestion, form: UseFormReturn<any> }) => {
    const isRequired = question.questionText.endsWith('*');
    const label = question.questionText.replace(/\*$/, '').replace(/\s\((select:|checkbox:).*?\)/i, '');
    
    const otherFieldName = `${question.questionText}_other`;

    // Use useWatch to get the value of the field for conditional rendering
    const selectValue = useWatch({
        control: form.control,
        name: question.questionText,
    });
    
    const otherCheckboxValue = useWatch({
        control: form.control,
        name: `${question.questionText}.Other`
    });

    let fieldComponent;
    
    switch (question.questionType) {
        case 'Text':
        case 'Url':
            fieldComponent = (
                <FormField
                    control={form.control}
                    name={question.questionText}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{label}{isRequired && ' *'}</FormLabel>
                            <FormControl>
                                <Input 
                                  placeholder={`Enter ${label.toLowerCase()}`} 
                                  type={question.questionType === 'Url' ? 'url' : 'text'}
                                  {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            );
            break;
        case 'Date':
             fieldComponent = (
                <FormField
                    control={form.control}
                    name={question.questionText}
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>{label}{isRequired && ' *'}</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full pl-3 text-left font-normal",
                                                !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            {field.value ? (
                                                format(field.value, "PPP")
                                            ) : (
                                                <span>Pick a date</span>
                                            )}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            );
            break;
        case 'Textarea':
             fieldComponent = (
                <FormField
                    control={form.control}
                    name={question.questionText}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{label}{isRequired && ' *'}</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Describe in detail..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            );
            break;
        case 'Select':
            fieldComponent = (
                <>
                <FormField
                    control={form.control}
                    name={question.questionText}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{label}{isRequired && ' *'}</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder={`Select a ${label.toLowerCase()}`} />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {question.options?.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {selectValue === 'Other' && (
                     <FormField
                        control={form.control}
                        name={otherFieldName}
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Input placeholder="Please specify" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
                </>
            );
            break;
        case 'Checkbox':
            fieldComponent = (
                 <FormItem>
                   <div className="mb-4">
                    <FormLabel>{label}{isRequired && ' *'}</FormLabel>
                   </div>
                   {question.options?.map((option) => {
                    if (option === 'Other') return null; // Render 'Other' separately
                    return (
                     <FormField
                       key={option}
                       control={form.control}
                       name={`${question.questionText}.${option}`}
                       render={({ field }) => (
                         <FormItem className="flex flex-row items-start space-x-3 space-y-0 mb-2">
                           <FormControl>
                             <Checkbox
                               checked={field.value}
                               onCheckedChange={field.onChange}
                             />
                           </FormControl>
                           <FormLabel className="font-normal">
                             {option}
                           </FormLabel>
                         </FormItem>
                       )}
                     />
                   )})}
                    {question.options?.includes('Other') && (
                        <div className="mt-2">
                            <FormField
                                key="Other"
                                control={form.control}
                                name={`${question.questionText}.Other`}
                                render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormLabel className="font-normal">
                                        Other
                                    </FormLabel>
                                     {otherCheckboxValue && (
                                        <FormField
                                            control={form.control}
                                            name={otherFieldName}
                                            render={({ field: otherField }) => (
                                                <FormControl>
                                                    <Textarea className="h-8" placeholder="Please specify" {...otherField} />
                                                </FormControl>
                                            )}
                                        />
                                     )}
                                </FormItem>
                                )}
                            />
                        </div>
                    )}
                   <FormMessage />
                 </FormItem>
            );
            break;
        default:
            fieldComponent = null;
    }
    return fieldComponent;
};

// Function to generate the Zod schema and default values dynamically
const generateFormSchemaAndDefaults = (questions: FormQuestion[], teams: string[], workType: string) => {
    const schemaDefinition: Record<string, any> = {
        'Team': z.string(),
        'Work Type': z.string(),
    };

    const defaultValues: Record<string, any> = {
        'Team': teams.join(', '),
        'Work Type': workType,
    };

    questions.forEach(q => {
        const isRequired = q.questionText.endsWith('*');
        const questionKey = q.questionText;

        if (q.questionType === 'Checkbox') {
            const checkboxOptions = q.options || [];
            const checkboxSchemaObject = checkboxOptions.reduce((acc, option) => {
                    acc[option] = z.boolean().default(false);
                    return acc;
                }, {} as Record<string, z.ZodBoolean>);

            const checkboxSchema = z.object(checkboxSchemaObject);
            
            schemaDefinition[questionKey] = isRequired 
                ? checkboxSchema.refine(data => Object.values(data).some(v => v), { message: "At least one option must be selected." }) 
                : checkboxSchema;

            defaultValues[questionKey] = checkboxOptions.reduce((acc, option) => {
                acc[option] = false;
                return acc;
            }, {} as Record<string, boolean>);
            
            if (checkboxOptions.includes('Other')) {
                const otherFieldName = `${questionKey}_other`;
                schemaDefinition[otherFieldName] = z.string().optional();
                defaultValues[otherFieldName] = '';
            }

        } else if (q.questionType === 'Date') {
            schemaDefinition[questionKey] = isRequired 
                ? z.date({ required_error: "A date is required."}) 
                : z.date().optional().nullable();
            defaultValues[questionKey] = null;
        } else if (q.questionType === 'Select') {
            schemaDefinition[questionKey] = isRequired 
                ? z.string().min(1, 'This field is required.') 
                : z.string().optional();
            defaultValues[questionKey] = '';

            if (q.options?.includes('Other')) {
                const otherFieldName = `${questionKey}_other`;
                schemaDefinition[otherFieldName] = z.string().optional();
                defaultValues[otherFieldName] = '';
            }
        } else {
            schemaDefinition[questionKey] = isRequired 
                ? z.string().min(1, 'This field is required.') 
                : z.string().optional();
            defaultValues[questionKey] = '';
        }
    });
    
    // Add validation refinements for 'Other' fields
    const finalSchema = z.object(schemaDefinition).superRefine((data, ctx) => {
        questions.forEach(q => {
             if (q.options?.includes('Other')) {
                const otherFieldName = `${q.questionText}_other`;
                if (q.questionType === 'Select') {
                     if (data[q.questionText] === 'Other' && !data[otherFieldName]) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: [otherFieldName],
                            message: "Please specify the 'Other' value.",
                        });
                    }
                } 
                else if (q.questionType === 'Checkbox') {
                    if (data[q.questionText]?.['Other'] && !data[otherFieldName]) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: [otherFieldName],
                            message: "Please specify the 'Other' value.",
                        });
                    }
                }
             }
        });
    });

    return {
        schema: finalSchema,
        defaultValues,
    };
};

function ActualForm({ formSchema, defaultValues, formQuestions, workType }: {
    formSchema: z.ZodObject<any, any, any>,
    defaultValues: Record<string, any>,
    formQuestions: FormQuestion[],
    workType: string,
}) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: defaultValues,
    });

    function onValidationError() {
        toast({
            description: "Please fill out all required fields.",
        });
    }

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true);

        const processedValues: Record<string, any> = { ...values };
        
        formQuestions.forEach(q => {
            const value = processedValues[q.questionText];
            const otherFieldName = `${q.questionText}_other`;
            const otherValue = processedValues[otherFieldName];

            if (q.questionType === 'Select' && value === 'Other') {
                processedValues[q.questionText] = `Other: ${otherValue}`;
            }

            if (q.questionType === 'Checkbox' && value) {
                const selectedOptions = Object.entries(value)
                    .filter(([, checked]) => checked)
                    .map(([option]) => {
                        if (option === 'Other') {
                            return `Other: ${otherValue}`;
                        }
                        return option;
                    })
                    .join(', ');
                processedValues[q.questionText] = selectedOptions;
            }

            delete processedValues[otherFieldName]; // Clean up extra field

            if (q.questionType === 'Date' && value instanceof Date) {
                 processedValues[q.questionText] = format(value, 'yyyy-MM-dd');
            }
        });

        const submissionResult = await submitTicket(processedValues);

        if (submissionResult.success) {
            toast({
                title: 'Ticket Submitted!',
                description: 'Your ticket has been submitted successfully.',
            });
            form.reset(defaultValues);
        } else {
            toast({
                variant: 'destructive',
                title: 'Submission Error',
                description: submissionResult.error || 'Failed to submit ticket to Google Sheet.',
            });
        }
        setIsSubmitting(false);
    }
    
    const getCardClasses = () => {
        if (workType === 'Urgent') {
            return 'border-red-500/50';
        }
        if (workType === 'Regular') {
            return 'border-green-500/50';
        }
        return '';
    }

    return (
        <Card className={`transition-all ${getCardClasses()}`}>
            <CardContent className="p-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit, onValidationError)} className="space-y-6">
                        {formQuestions.map(question => (
                            <FormFieldBuilder key={question.id} question={question} form={form} />
                        ))}
                        <Button type="submit" disabled={isSubmitting} className="w-full">
                            {isSubmitting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                'Submit Ticket'
                            )}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

export function TicketForm({ teams, workType }: { teams: string[]; workType: string; }) {
    const [isLoading, setIsLoading] = useState(true);
    const [formConfig, setFormConfig] = useState<{
        formSchema: z.ZodObject<any, any, any>,
        defaultValues: Record<string, any>,
        formQuestions: FormQuestion[],
    } | null>(null);

    const { toast } = useToast();
    
    useEffect(() => {
        const fetchAndBuildConfig = async () => {
            if (!teams || teams.length === 0) {
                setFormConfig(null);
                setIsLoading(false);
                return;
            };
            
            setIsLoading(true);

            try {
                const allQuestionsPromises = teams.map(team => getFormQuestions(team));
                const allQuestionsArrays = await Promise.all(allQuestionsPromises);
                
                const questionMap = new Map<string, FormQuestion>();
                
                allQuestionsArrays.flat().forEach(question => {
                    const existing = questionMap.get(question.questionText.replace(/\*$/, '').trim());
                     // If the new question is required, it takes precedence
                    if (!existing || (!existing.questionText.endsWith('*') && question.questionText.endsWith('*'))) {
                        questionMap.set(question.questionText.replace(/\*$/, '').trim(), question);
                    }
                });

                const uniqueQuestions = Array.from(questionMap.values());
    
                const { schema, defaultValues } = generateFormSchemaAndDefaults(uniqueQuestions, teams, workType);
                
                setFormConfig({
                    formSchema: schema,
                    defaultValues,
                    formQuestions: uniqueQuestions
                });

            } catch (error) {
                console.error("Failed to fetch form questions:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not load form questions." });
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchAndBuildConfig();
    }, [teams, workType, toast]); 


    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="mr-2 h-8 w-8 animate-spin" /> Loading form...</div>
    }

    if (!formConfig && !isLoading) {
         if (teams.length > 0) {
            return <p className="text-center text-muted-foreground">No form questions have been configured for the selected team(s).</p>
         }
         return null; // Don't render anything if no teams are selected
    }
    
    if (formConfig) {
        return <ActualForm key={teams.join('-')} {...formConfig} workType={workType} />;
    }

    return null;
}

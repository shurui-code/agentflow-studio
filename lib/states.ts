// lib/states.ts
import { Annotation } from "@langchain/langgraph";

export const VotingGraphStateAnnotation = Annotation.Root({
    votingVotes: Annotation<any[]>({
        default: () => [],
        reducer: (x, y) => x.concat(y),
    }),
    votingInput: Annotation<string>,
    votingOutput: Annotation<string>,
    scoreData: Annotation<any>,
});

export const SequentialGraphStateAnnotation = Annotation.Root({
    sequentialInput: Annotation<string>,
    sequentialFirstAgentOutput: Annotation<any>,
    sequentialSecondAgentOutput: Annotation<string>,
    sequentialOutput: Annotation<string>,
    scoreData: Annotation<any>,
});

export const SingleAgentGraphAnnotation = Annotation.Root({
    singleAgentInput: Annotation<string>,
    singleAgentOutput: Annotation<string>,
    scoreData: Annotation<any>,
});
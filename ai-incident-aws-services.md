# AWS Services and Concepts Used in AI Incident Triage Deployment

  ------------------------------------------------------------------------
  Service / Concept Category /         What does it do?  Why did we use it
                    Sub-Category                         in this project?
  ----------------- ------------------ ----------------- -----------------
  Amazon ECS        Compute, Container Managed container Used to
  (Elastic          Orchestration      orchestration     orchestrate the
  Container                            service that runs backend AI
  Service)                             and manages       Incident Triage
                                       Docker            service
                                       containers.       containers and
                                                         ensure tasks are
                                                         running reliably.

  AWS Fargate       Compute,           Serverless        Used to run ECS
                    Serverless         compute engine    tasks without
                    Containers         for containers    managing
                                       that removes the  infrastructure,
                                       need to manage    allowing the
                                       EC2 servers.      backend AI
                                                         service to scale
                                                         automatically.

  Amazon ECR        Containers, Image  Secure container  Used to store the
  (Elastic          Registry           image registry    backend Docker
  Container                            for storing       image and allow
  Registry)                            Docker images.    ECS to pull and
                                                         run the
                                                         container.

  ECS Cluster       Container          Logical grouping  Used to organize
                    Infrastructure     of compute        and run the
                                       capacity where    triage backend
                                       ECS tasks run.    containers.

  ECS Task          Container          Blueprint         Used to define
  Definition        Configuration      describing        how the triage
                                       container         backend container
                                       configuration     should run.
                                       such as image,    
                                       CPU, memory,      
                                       environment       
                                       variables, and    
                                       ports.            

  ECS Task          Container Runtime  A running         Represents the
                                       instance of a     running AI triage
                                       container based   backend container
                                       on a task         processing
                                       definition.       requests.

  ECS Service       Container          Ensures a         Used to keep the
                    Management         specified number  backend container
                                       of tasks are      continuously
                                       always running    running and
                                       and integrates    automatically
                                       with load         restart failed
                                       balancers.        tasks.

  Amazon VPC        Networking         Provides isolated Used to securely
  (Virtual Private                     virtual           host ECS
  Cloud)                               networking in     services, load
                                       AWS.              balancers, and
                                                         networking
                                                         resources.

  Subnets           Networking, VPC    Logical           Used to separate
                    Components         subdivisions of a public components
                                       VPC used to       like the load
                                       control traffic   balancer from
                                       routing.          backend container
                                                         workloads.

  Security Groups   Networking,        Virtual firewall  Used to allow
                    Firewall           controlling       HTTP traffic to
                                       inbound and       the load balancer
                                       outbound traffic  and permit
                                       for AWS           communication
                                       resources.        between ALB and
                                                         ECS containers.

  Application Load  Networking, Load   Layer-7 load      Used as the
  Balancer (ALB)    Balancing          balancer that     public entry
                                       distributes       point for the
                                       HTTP/HTTPS        triage API and to
                                       traffic across    route traffic to
                                       multiple targets. ECS tasks.

  Target Groups     Load Balancing     Logical groups of Used to route
                                       backend resources traffic from the
                                       that receive      ALB to the ECS
                                       traffic from a    container
                                       load balancer.    instances running
                                                         the backend
                                                         service.

  Amazon CloudFront Networking, CDN    Global content    Used to
                                       delivery network  accelerate
                                       that caches and   frontend delivery
                                       delivers content  and reduce
                                       from edge         latency for users
                                       locations.        accessing the
                                                         system.

  Amazon API        API Management     Fully managed     Used as an API
  Gateway                              service for       front door to
                                       creating,         expose triage
                                       publishing, and   service endpoints
                                       securing APIs.    in a structured
                                                         and scalable way.

  AWS               Infrastructure as  Service for       Used to deploy
  CloudFormation    Code               provisioning AWS  the ECS cluster,
                                       resources using   networking, load
                                       declarative       balancer, and
                                       templates.        other
                                                         infrastructure
                                                         consistently and
                                                         reproducibly.

  AWS IAM (Identity Security           Manages           Used to provide
  and Access                           permissions and   ECS task roles,
  Management)                          roles for AWS     ECR access
                                       services and      permissions, and
                                       users.            CloudFormation
                                                         deployment
                                                         permissions.

  AWSVPC Network    Container          Networking mode   Used with Fargate
  Mode              Networking         where each        to allow
                                       container         containers to
                                       receives its own  communicate
                                       elastic network   securely within
                                       interface within  the VPC.
                                       the VPC.          

  Amazon CloudWatch Monitoring and     Collects logs,    Used to monitor
                    Observability      metrics, and      ECS tasks,
                                       monitoring data   application logs,
                                       for AWS           and system
                                       resources.        metrics for the
                                                         triage service.

  Docker            Containerization   Tool used to      Used to
                    Platform           package           containerize the
                                       applications and  backend FastAPI
                                       dependencies into service before
                                       containers.       pushing it to ECR
                                                         and running it in
                                                         ECS.

  Infrastructure as DevOps Concept     Practice of       Implemented
  Code (IaC)                           managing          through
                                       infrastructure    CloudFormation
                                       using code        templates to
                                       templates rather  deploy the entire
                                       than manual       AI triage
                                       configuration.    infrastructure
                                                         automatically.
  ------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { socket } from './socket';

interface Point { x: number; y: number }
interface Stroke {
  id: string;
  color: string;
  width: number;
  tool: 'brush' | 'eraser';
  points: Point[];
  userId: string;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(4);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [users, setUsers] = useState<any[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Ссылки для хранения состояния без перерисовок
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const lastSeqRef = useRef(0);
  const currentPointRef = useRef<Point>({ x: 0, y: 0 });

  // Функция перерисовки всего холста
  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    strokesRef.current.forEach(stroke => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });

    // Рисуем текущую линию, которую пользователь ведет прямо сейчас
    if (currentStrokeRef.current) {
      const s = currentStrokeRef.current;
      ctx.beginPath();
      ctx.strokeStyle = s.tool === 'eraser' ? '#ffffff' : s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.points.length > 0) {
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
      }
    }
  };

  // Подключение к серверу и обработка событий
  useEffect(() => {
    socket.emit('room:join', { roomId: 'test-room', userName: 'User_' + Math.floor(Math.random() * 1000) });

    socket.on('room:state', (data) => {
      strokesRef.current = data.strokes;
      setUsers(data.users);
      lastSeqRef.current = data.seq;
      redraw();
    });

    socket.on('draw:stroke', ({ stroke, seq }) => {
      if (seq <= lastSeqRef.current) return;
      lastSeqRef.current = seq;
      strokesRef.current.push(stroke);
      redraw();
    });

    socket.on('draw:cleared', ({ seq }) => {
      if (seq <= lastSeqRef.current) return;
      lastSeqRef.current = seq;
      strokesRef.current = [];
      redraw();
    });

    socket.on('room:user-joined', ({ user }) => {
      setUsers(prev => [...prev, user]);
    });

    socket.on('room:user-left', ({ userId }) => {
      setUsers(prev => prev.filter(u => u.id !== userId));
    });

    // Настройка размера холста под экран
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight - 60;
        redraw();
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // вызываем сразу при старте

    return () => {
      socket.off('room:state');
      socket.off('draw:stroke');
      socket.off('draw:cleared');
      socket.off('room:user-joined');
      socket.off('room:user-left');
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Обработчики мыши
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newStroke: Stroke = {
      id: Math.random().toString(36).substring(7),
      color,
      width,
      tool,
      userId: socket.id || 'local',
      points: [{ x, y }]
    };

    currentStrokeRef.current = newStroke;
    currentPointRef.current = { x, y };
    setIsDrawing(true);
    
    socket.emit('draw:stroke-start', { stroke: { id: newStroke.id, color, width, tool } });
    redraw();
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStrokeRef.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentStrokeRef.current.points.push({ x, y });
    
    // Отправляем точки батчами (в данном упрощенном случае каждую, но можно оптимизировать)
    socket.emit('draw:stroke-point', { 
      strokeId: currentStrokeRef.current.id, 
      point: { x, y } 
    });

    redraw();
  };

  const stopDrawing = () => {
    if (!currentStrokeRef.current) return;
    setIsDrawing(false);
    socket.emit('draw:stroke-end', { strokeId: currentStrokeRef.current.id });
    currentStrokeRef.current = null;
    redraw();
  };

  const clearCanvas = () => {
    socket.emit('draw:clear');
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Панель инструментов */}
      <div className="flex items-center gap-4 p-3 bg-white shadow-sm z-10">
        <h1 className="font-bold text-xl text-gray-800 mr-4">DrawTogether</h1>
        
        <input 
          type="color" 
          value={color} 
          onChange={(e) => setColor(e.target.value)}
          className="w-8 h-8 cursor-pointer rounded"
          disabled={tool === 'eraser'}
        />
        
        <input 
          type="range" 
          min="1" max="20" 
          value={width} 
          onChange={(e) => setWidth(Number(e.target.value))}
          className="cursor-pointer"
        />
        
        <button 
          onClick={() => setTool(tool === 'brush' ? 'eraser' : 'brush')}
          className={`px-4 py-1 rounded border font-medium ${tool === 'brush' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-gray-100 border-gray-300 text-gray-700'}`}
        >
          {tool === 'brush' ? '🖌️ Кисть' : '🧽 Ластик'}
        </button>

        <button 
          onClick={clearCanvas}
          className="px-4 py-1 bg-red-50 text-red-600 border border-red-200 rounded font-medium hover:bg-red-100 transition"
        >
          Очистить
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-500">Онлайн: {users.length}</span>
          <div className="flex -space-x-2">
            {users.map((u, i) => (
              <div 
                key={i} 
                className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow"
                style={{ backgroundColor: u.color }}
                title={u.name}
              >
                {u.name[0]}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Холст */}
      <canvas
        ref={canvasRef}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        className="flex-1 cursor-crosshair touch-none bg-white"
      />
    </div>
  );
}
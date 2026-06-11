
'use client';

import { BarChart3, Boxes, DollarSign, ShoppingCart, Truck, TrendingUp } from "lucide-react";
import './animated-hero.css';

const featureFaces = [
    {
        icon: <Boxes size={48} strokeWidth={1} />,
        label: "Inventory",
        className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    },
    {
        icon: <TrendingUp size={48} strokeWidth={1} />,
        label: "Sales",
        className: "bg-green-500/10 text-green-400 border-green-500/20",
    },
    {
        icon: <Truck size={48} strokeWidth={1} />,
        label: "Suppliers",
        className: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    },
    {
        icon: <BarChart3 size={48} strokeWidth={1} />,
        label: "Reports",
        className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    },
    {
        icon: <ShoppingCart size={48} strokeWidth={1} />,
        label: "Orders",
        className: "bg-red-500/10 text-red-400 border-red-500/20",
    },
    {
        icon: <DollarSign size={48} strokeWidth={1} />,
        label: "Value",
        className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    },
];

export function AnimatedHero() {
  return (
    <div className="scene-container">
      <div className="scene">
        <div className="cube">
          {featureFaces.map((face, index) => (
            <div key={index} className={`cube__face cube__face--${index + 1} ${face.className}`}>
                <div className="flex flex-col items-center justify-center gap-2">
                    {face.icon}
                    <p className="font-semibold text-lg">{face.label}</p>
                </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
